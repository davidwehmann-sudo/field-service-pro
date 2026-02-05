import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receipt_url } = await req.json();

    if (!receipt_url) {
      return Response.json({ error: 'receipt_url is required' }, { status: 400 });
    }

    // Get all parts orders for this receipt
    const partsOrders = await base44.entities.PartsOrder.filter({ receipt_url });

    if (partsOrders.length === 0) {
      return Response.json({ error: 'No parts found for this receipt' }, { status: 404 });
    }

    // Find the total shipping cost from any part that has it set
    const totalShipping = partsOrders.reduce((max, order) => 
      Math.max(max, order.shipping_cost || 0), 0);

    if (totalShipping === 0) {
      return Response.json({ 
        message: 'No shipping cost to distribute',
        updated: 0 
      });
    }

    // Calculate total value of all parts (unit_cost * quantity)
    const totalValue = partsOrders.reduce((sum, order) => 
      sum + ((order.unit_cost || 0) * (order.quantity || 1)), 0);

    if (totalValue === 0) {
      return Response.json({ error: 'Total value is zero, cannot distribute' }, { status: 400 });
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

    return Response.json({
      message: 'Shipping costs distributed successfully',
      total_shipping: totalShipping,
      total_value: totalValue,
      parts_updated: updates.length,
      updates
    });

  } catch (error) {
    console.error('Error distributing shipping:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});