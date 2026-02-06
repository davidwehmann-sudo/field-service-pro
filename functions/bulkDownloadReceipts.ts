import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { start_date, end_date } = await req.json();

    // Audit log: ServiceRole usage
    console.log(`[AUDIT] ServiceRole accessed by ${user.email} (${user.role}) for bulkDownloadReceipts - Date range: ${start_date} to ${end_date}`);

    if (!start_date || !end_date) {
      return Response.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    // Query PartsOrder and VehicleExpense for records in date range
    const partsOrders = await base44.asServiceRole.entities.PartsOrder.filter({
      created_date: { $gte: start_date, $lte: end_date },
      receipt_url: { $ne: null }
    });

    const vehicleExpenses = await base44.asServiceRole.entities.VehicleExpense.filter({
      created_date: { $gte: start_date, $lte: end_date },
      receipt_url: { $ne: null }
    });

    // Collect all unique receipt URLs
    const receiptUrls = new Set();
    
    partsOrders.forEach(order => {
      if (order.receipt_url) receiptUrls.add(order.receipt_url);
    });

    vehicleExpenses.forEach(expense => {
      if (expense.receipt_url) receiptUrls.add(expense.receipt_url);
    });

    const urls = Array.from(receiptUrls);

    // Check if any URLs are private (contain 'private' or certain patterns)
    // For private files, generate signed URLs
    const downloadLinks = await Promise.all(
      urls.map(async (url) => {
        // If URL looks like a private file path (not a full HTTP URL), generate signed URL
        if (url && !url.startsWith('http')) {
          try {
            const signedData = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
              file_uri: url,
              expires_in: 3600 // 1 hour expiry
            });
            return {
              original_url: url,
              download_url: signedData.signed_url,
              filename: url.split('/').pop()
            };
          } catch (error) {
            console.error(`Error creating signed URL for ${url}:`, error);
            return {
              original_url: url,
              download_url: url,
              filename: url.split('/').pop(),
              error: 'Failed to generate signed URL'
            };
          }
        }
        
        // Public URL - use as is
        return {
          original_url: url,
          download_url: url,
          filename: url.split('/').pop()
        };
      })
    );

    return Response.json({
      count: downloadLinks.length,
      date_range: { start_date, end_date },
      receipts: downloadLinks
    });

  } catch (error) {
    console.error('Error in bulkDownloadReceipts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});