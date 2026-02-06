import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all parts orders
    const allPartsOrders = await base44.asServiceRole.entities.PartsOrder.list();

    // Group by receipt_url
    const receiptGroups = {};
    for (const order of allPartsOrders) {
      if (order.receipt_url && order.receipt_url.trim()) {
        if (!receiptGroups[order.receipt_url]) {
          receiptGroups[order.receipt_url] = [];
        }
        receiptGroups[order.receipt_url].push(order);
      }
    }

    const results = [];
    let totalReceipts = 0;
    let totalPartsUpdated = 0;

    // Process each receipt
    for (const [receipt_url, partsOrders] of Object.entries(receiptGroups)) {
      // Find the total shipping cost from any part that has it set
      const totalShipping = partsOrders.reduce((max, order) => 
        Math.max(max, order.shipping_cost || 0), 0);

      if (totalShipping === 0) {
        continue; // Skip receipts with no shipping
      }

      // Calculate total value of all parts (unit_cost * quantity)
      const totalValue = partsOrders.reduce((sum, order) => 
        sum + ((order.unit_cost || 0) * (order.quantity || 1)), 0);

      if (totalValue === 0) {
        console.log(`Skipping receipt ${receipt_url} - total value is zero`);
        continue;
      }

      // Distribute shipping proportionally and update each part
      const updates = [];
      for (const order of partsOrders) {
        const partValue = (order.unit_cost || 0) * (order.quantity || 1);
        const proportionalShipping = (partValue / totalValue) * totalShipping;
        
        await base44.asServiceRole.entities.PartsOrder.update(order.id, {
          shipping_cost: proportionalShipping
        });
        
        updates.push({
          id: order.id,
          part_description: order.part_description,
          original_shipping: order.shipping_cost,
          new_shipping: proportionalShipping
        });
      }

      totalReceipts++;
      totalPartsUpdated += updates.length;
      results.push({
        receipt_url,
        total_shipping: totalShipping,
        total_value: totalValue,
        parts_updated: updates.length
      });
    }

    return Response.json({
      message: 'Shipping costs redistributed for all receipts',
      receipts_processed: totalReceipts,
      total_parts_updated: totalPartsUpdated,
      results
    });

  } catch (error) {
    console.error('Error redistributing shipping:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});