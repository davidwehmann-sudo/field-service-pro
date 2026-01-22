import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const lineHeight = 7;
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('PRE-REPAIR SERVICE AUTHORIZATION', pageWidth / 2, y, { align: 'center' });
    y += lineHeight * 2;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Date: _____________________`, margin, y);
    y += lineHeight * 2;

    // Customer Information
    doc.setFont(undefined, 'bold');
    doc.text('CUSTOMER INFORMATION', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    doc.text('Customer/Company Name: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('Contact Person: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('Phone: ________________________  Email: ________________________', margin, y);
    y += lineHeight * 2;

    // Billing Contact
    doc.setFont(undefined, 'bold');
    doc.text('BILLING CONTACT (if different)', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    doc.text('Billing Contact Name: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('Company: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('Phone: ________________________  Email: ________________________', margin, y);
    y += lineHeight;
    doc.text('Address: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('City: ________________________  State: ______  ZIP: __________', margin, y);
    y += lineHeight * 2;

    // On-Site Contact
    doc.setFont(undefined, 'bold');
    doc.text('ON-SITE CONTACT', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    doc.text('Name: _________________________________________', margin, y);
    y += lineHeight;
    doc.text('Phone: _________________________________________', margin, y);
    y += lineHeight * 2;

    // Service Type
    doc.setFont(undefined, 'bold');
    doc.text('SERVICE TYPE (check one):', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    const serviceTypes = [
      '☐ Check & Advise',
      '☐ Consultation',
      '☐ Diagnostic',
      '☐ Repair',
      '☐ Preventive Maintenance',
      '☐ Emergency Service'
    ];
    
    serviceTypes.forEach(type => {
      doc.text(type, margin + 5, y);
      y += lineHeight;
    });
    y += lineHeight;

    // Equipment Info
    doc.setFont(undefined, 'bold');
    doc.text('EQUIPMENT INFORMATION', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    doc.text('Equipment Type/Description: _________________________________________', margin, y);
    y += lineHeight * 2;

    // Nature of Service
    doc.setFont(undefined, 'bold');
    doc.text('NATURE OF SERVICE / WORK TO BE PERFORMED:', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    
    for (let i = 0; i < 6; i++) {
      doc.text('_________________________________________', margin, y);
      y += lineHeight;
    }
    y += lineHeight;

    // Estimated Cost
    doc.setFont(undefined, 'bold');
    doc.text('ESTIMATED COST:', margin, y);
    y += lineHeight;
    doc.setFont(undefined, 'normal');
    doc.text('$ _____________________', margin, y);
    y += lineHeight * 2;

    // Authorization
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text('AUTHORIZATION', margin, y);
    y += lineHeight;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    const authText = 'I authorize the above service work to be performed. I understand that this is an estimate and the final cost may vary based on actual work required.';
    const splitText = doc.splitTextToSize(authText, pageWidth - (margin * 2));
    doc.text(splitText, margin, y);
    y += lineHeight * 3;

    // Signature
    doc.text('Authorized Signature: _________________________________________', margin, y);
    y += lineHeight * 1.5;
    doc.text('Print Name: _________________________________________', margin, y);
    y += lineHeight * 1.5;
    doc.text('Date: _____________________', margin, y);

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="blank-authorization-form.pdf"'
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});