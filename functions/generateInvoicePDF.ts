import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';
import 'npm:jspdf-autotable@3.8.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return Response.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Fetch invoice, customer, and service report data
    const invoice = await base44.entities.Invoice.get(invoice_id);
    
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    if (!invoice.customer_id) {
      return Response.json({ error: 'Invoice missing customer reference' }, { status: 400 });
    }
    
    const customer = await base44.entities.Customer.get(invoice.customer_id);
    
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    const serviceReport = invoice.service_report_id 
      ? await base44.entities.ServiceReport.get(invoice.service_report_id)
      : null;

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(40, 40, 40);
    doc.text('INVOICE', 20, y);
    
    // Invoice number
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Invoice #${invoice.invoice_number}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
    
    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Customer info
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('BILL TO:', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(customer.company_name || customer.contact_name, 20, y);
    y += 5;
    if (customer.address) {
      doc.text(customer.address, 20, y);
      y += 5;
    }
    if (customer.city && customer.state) {
      doc.text(`${customer.city}, ${customer.state} ${customer.zip || ''}`, 20, y);
      y += 5;
    }
    if (customer.phone) {
      doc.text(`Phone: ${customer.phone}`, 20, y);
      y += 5;
    }

    y += 10;

    // Service details
    if (serviceReport) {
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text('SERVICE DETAILS', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.text(`Date: ${new Date(serviceReport.service_date).toLocaleDateString()}`, 20, y);
      y += 5;
      if (serviceReport.equipment_type) {
        doc.text(`Equipment: ${serviceReport.equipment_make} ${serviceReport.equipment_model} ${serviceReport.equipment_type}`, 20, y);
        y += 5;
      }
      if (serviceReport.equipment_serial) {
        doc.text(`Serial: ${serviceReport.equipment_serial}`, 20, y);
        y += 5;
      }
      y += 5;
    }

    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Line items using autoTable for automatic page breaks
    const lineItems = [];
    if (invoice.labor_total > 0) {
      lineItems.push(['Labor', `$${invoice.labor_total.toFixed(2)}`]);
    }
    if (invoice.travel_total > 0) {
      lineItems.push(['Travel / Destination Fee', `$${invoice.travel_total.toFixed(2)}`]);
    }
    if (invoice.parts_total > 0) {
      lineItems.push(['Parts & Materials', `$${invoice.parts_total.toFixed(2)}`]);
    }

    doc.autoTable({
      startY: y,
      head: [['Description', 'Amount']],
      body: lineItems,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { textColor: [100, 100, 100], fontStyle: 'normal' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: 20, right: 20 }
    });

    y = doc.lastAutoTable.finalY + 8;

    // Subtotal
    const subtotal = (invoice.labor_total || 0) + (invoice.travel_total || 0) + (invoice.parts_total || 0);
    doc.text('Subtotal:', pageWidth - 80, y);
    doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
    y += 7;

    // Tax
    if (invoice.tax_amount > 0) {
      doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(2)}%):`, pageWidth - 80, y);
      doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
    }

    y += 2;
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 80, y, pageWidth - 20, y);
    y += 8;

    // Total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', pageWidth - 80, y);
    doc.text(`$${invoice.total_amount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });

    // Payment status
    y += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (invoice.status === 'paid') {
      doc.setTextColor(0, 150, 0);
      doc.text('PAID', pageWidth - 20, y, { align: 'right' });
      if (invoice.payment_date) {
        doc.text(`Payment Date: ${new Date(invoice.payment_date).toLocaleDateString()}`, pageWidth - 20, y + 5, { align: 'right' });
      }
      if (invoice.payment_method) {
        doc.text(`Method: ${invoice.payment_method}`, pageWidth - 20, y + 10, { align: 'right' });
      }
    } else {
      doc.setTextColor(200, 0, 0);
      doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - 20, y, { align: 'right' });
    }

    // Notes
    if (invoice.notes) {
      y += 20;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Notes:', 20, y);
      y += 5;
      const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 40);
      doc.text(splitNotes, 20, y);
    }

    // Return PDF as base64
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${invoice.invoice_number}.pdf`
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});