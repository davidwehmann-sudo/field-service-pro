import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { customer_id, portal_url } = await req.json();

    if (!customer_id || !portal_url) {
      return Response.json({ error: 'Customer ID and portal URL required' }, { status: 400 });
    }

    // Fetch customer
    const customer = await base44.entities.Customer.get(customer_id);

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 40;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(40, 40, 40);
    doc.text('Customer Portal Access', pageWidth / 2, y, { align: 'center' });
    
    y += 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(30, y, pageWidth - 30, y);
    y += 20;

    // Customer info
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('For: ' + (customer.company_name || customer.contact_name), pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Instructions
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Welcome to your customer portal!', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(10);
    const instructions = [
      'Your portal provides access to:',
      '',
      '• View your service history',
      '• Track current service requests',
      '• Request new service',
      '• Communicate with technicians',
      '• View and pay invoices'
    ];

    for (const line of instructions) {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += 6;
    }

    y += 10;

    // Access URL box
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(30, y, pageWidth - 60, 30, 3, 3, 'F');
    
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Portal Access Link:', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(9);
    doc.setTextColor(0, 100, 200);
    doc.textWithLink(portal_url, pageWidth / 2, y, { 
      align: 'center',
      url: portal_url
    });

    y += 20;

    // Instructions for use
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('How to Access:', 40, y);
    y += 8;
    
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const accessInstructions = [
      '1. Type or scan the link above into your web browser',
      '2. Bookmark the page for easy access later',
      '3. The link is valid for 90 days',
      '4. Contact us if you need a new link or have questions'
    ];

    for (const line of accessInstructions) {
      const splitLine = doc.splitTextToSize(line, pageWidth - 80);
      doc.text(splitLine, 40, y);
      y += splitLine.length * 5 + 2;
    }

    y += 15;

    // Contact info box
    doc.setDrawColor(200, 200, 200);
    doc.rect(30, y, pageWidth - 60, 25);
    y += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Need Help?', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.text('Contact us for assistance with your portal access', pageWidth / 2, y, { align: 'center' });
    y += 5;
    if (customer.phone) {
      doc.text(`Customer Phone: ${customer.phone}`, pageWidth / 2, y, { align: 'center' });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This document contains your private portal access link. Keep it secure.', 
      pageWidth / 2, pageHeight - 20, { align: 'center' });

    // Return PDF
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=portal-access-${customer.id.substring(0, 8)}.pdf`
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});