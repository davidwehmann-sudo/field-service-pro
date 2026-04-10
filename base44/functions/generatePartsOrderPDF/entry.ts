import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { part_ids } = await req.json();

    if (!part_ids || part_ids.length === 0) {
      return Response.json({ error: 'Part IDs required' }, { status: 400 });
    }

    // Fetch all parts
    const parts = await Promise.all(
      part_ids.map(id => base44.entities.PartsOrder.get(id))
    );

    // Group by supplier
    const partsBySupplier = {};
    for (const part of parts) {
      const supplier = part.supplier || 'Unspecified Supplier';
      if (!partsBySupplier[supplier]) {
        partsBySupplier[supplier] = [];
      }
      partsBySupplier[supplier].push(part);
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;
    let isFirstPage = true;

    for (const [supplier, supplierParts] of Object.entries(partsBySupplier)) {
      if (!isFirstPage) {
        doc.addPage();
        y = 20;
      }
      isFirstPage = false;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('PARTS ORDER FORM', 20, y);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
      doc.text(`Order #: ${Date.now()}`, pageWidth - 20, y + 5, { align: 'right' });
      
      y += 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageWidth - 20, y);
      y += 10;

      // Supplier info
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      doc.text('TO: ' + supplier, 20, y);
      y += 10;

      // Parts table header
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Part #', 20, y);
      doc.text('Description', 60, y);
      doc.text('Qty', 140, y);
      doc.text('Cost', pageWidth - 20, y, { align: 'right' });
      y += 5;
      doc.line(20, y, pageWidth - 20, y);
      y += 8;

      // Parts list
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      let orderTotal = 0;

      for (const part of supplierParts) {
        // Check for page break
        if (y > 270) {
          doc.addPage();
          y = 20;
          // Reprint header on new page
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text('Part #', 20, y);
          doc.text('Description', 60, y);
          doc.text('Qty', 140, y);
          doc.text('Cost', pageWidth - 20, y, { align: 'right' });
          y += 5;
          doc.line(20, y, pageWidth - 20, y);
          y += 8;
          doc.setTextColor(40, 40, 40);
        }

        const partNumber = part.part_number || 'N/A';
        const description = part.part_description || '';
        const quantity = part.quantity || 1;
        const unitCost = part.unit_cost || 0;
        const lineCost = quantity * unitCost;
        orderTotal += lineCost;

        // Part number
        const partNumLines = doc.splitTextToSize(partNumber, 35);
        doc.text(partNumLines, 20, y);

        // Description
        const descLines = doc.splitTextToSize(description, 75);
        doc.text(descLines, 60, y);

        // Quantity and cost on same line as first line of description
        doc.text(quantity.toString(), 140, y);
        doc.text(`$${unitCost.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });

        // Move y down by the max lines
        y += Math.max(partNumLines.length, descLines.length) * 5 + 3;
      }

      // Total
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageWidth - 20, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('ORDER TOTAL:', pageWidth - 60, y);
      doc.text(`$${orderTotal.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 15;

      // Instructions
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Please process this order and confirm availability.', 20, y);
      y += 5;
      doc.text('Contact us if you have any questions or need clarification.', 20, y);
      y += 15;

      // Contact section
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text('Ship To / Contact:', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.text('________________________', 20, y);
      y += 7;
      doc.text('________________________', 20, y);
      y += 7;
      doc.text('Phone: ___________________', 20, y);
    }

    // Return PDF
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=parts-order-${Date.now()}.pdf`
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});