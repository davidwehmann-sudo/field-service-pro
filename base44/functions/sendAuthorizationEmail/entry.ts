import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.2';

const COMPANY_NAME = 'Wehmann Equipment Service';
const COMPANY_PHONE = '(Your Phone)';
const COMPANY_EMAIL = 'office@wehmanntexas.com';
const COMPANY_ADDRESS = '';

function buildAuthorizationPDF(data) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const colRight = pageWidth - margin;
  let y = 20;

  const section = (title) => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, colRight - margin, 8, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
    doc.setTextColor(30, 41, 59);
  };

  const row = (label, value, x1 = margin, maxWidth = colRight - margin - x1) => {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text(label + ':', x1, y);
    doc.setFont(undefined, 'normal');
    const val = value || '—';
    const lines = doc.splitTextToSize(val, maxWidth - 30);
    doc.text(lines, x1 + 30, y);
    y += lines.length * 5 + 2;
  };

  // Header
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Service Authorization Form', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY_NAME, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`${COMPANY_PHONE}  |  ${COMPANY_EMAIL}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Date: ${data.authorization_date || new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, colRight, y);
  y += 6;

  // Customer / Billing Info
  section('Customer & Billing Information');
  row('Customer', data.billing_contact_company || data.company_name);
  row('Contact', data.billing_contact_name);
  row('Phone', data.billing_contact_phone);
  row('Email', data.billing_contact_email);
  row('Address', [data.billing_address, data.billing_city, data.billing_state, data.billing_zip].filter(Boolean).join(', '));
  y += 2;

  // On-site contact
  if (data.on_site_contact_name || data.on_site_contact_phone) {
    section('On-Site Contact');
    row('Name', data.on_site_contact_name);
    row('Phone', data.on_site_contact_phone);
    y += 2;
  }

  // Service details
  section('Service Details');
  row('Service Type', data.service_type_label || data.service_type);
  row('Equipment', data.equipment_info);
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Description:', margin, y);
  y += 5;
  doc.setFont(undefined, 'normal');
  const descLines = doc.splitTextToSize(data.nature_of_service || '—', colRight - margin - 5);
  doc.text(descLines, margin, y);
  y += descLines.length * 5 + 4;

  // Billing structure
  section('Billing Structure');
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(30, 41, 59);
  const billingLines = [
    '• All Services: $200/hr (3-hour minimum)',
    '• Travel/destination fees based on location',
    '• Parts billed at cost + standard markup',
    '• General technician supplies fee: starts at $35 (may increase for demanding jobs)',
    '• Sales tax applied where applicable',
  ];
  for (const line of billingLines) {
    doc.text(line, margin + 2, y);
    y += 5;
  }
  y += 2;
  row('Customer Initials', data.customer_initials);
  y += 2;

  // Parts deposit
  section('Parts Deposit Notice');
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  const depositText = 'A parts deposit equal to the cost of required parts will be collected prior to ordering. Work will not proceed until the parts deposit has been received.';
  const depositLines = doc.splitTextToSize(depositText, colRight - margin - 5);
  doc.text(depositLines, margin, y);
  y += depositLines.length * 5 + 2;
  if (data.parts_payment_note) {
    row('Notes', data.parts_payment_note);
  }
  y += 2;

  if (data.notes) {
    section('Additional Notes');
    const noteLines = doc.splitTextToSize(data.notes, colRight - margin - 5);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 4;
  }

  // Signature
  section('Authorization');
  doc.setFontSize(8.5);
  doc.setFont(undefined, 'normal');
  const authLines = [
    'By signing below, the customer authorizes inspection, diagnosis, and repair as described above,',
    'and agrees to pay for actual services rendered and parts used.',
  ];
  for (const line of authLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  // Signature image
  if (data.authorization_signature && data.authorization_signature.startsWith('data:image')) {
    try {
      doc.addImage(data.authorization_signature, 'PNG', margin, y, 70, 20);
      y += 22;
    } catch (_) {
      // skip if image fails
    }
  }

  doc.setDrawColor(30, 41, 59);
  doc.line(margin, y, margin + 80, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Customer Signature', margin, y);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`${COMPANY_NAME}  |  ${COMPANY_PHONE}  |  ${COMPANY_EMAIL}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

  return doc.output('arraybuffer');
}

const SERVICE_TYPE_LABELS = {
  check_and_advise: 'Check and Advise',
  consultation: 'Consultation',
  diagnostic: 'Diagnostic',
  repair: 'Repair',
  preventive_maintenance: 'Preventive Maintenance',
  emergency_service: 'Emergency Service',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { authorization_id } = body;

    if (!authorization_id) {
      return Response.json({ error: 'authorization_id required' }, { status: 400 });
    }

    const auth = await base44.asServiceRole.entities.PreRepairAuthorization.get(authorization_id);
    const customer = await base44.asServiceRole.entities.Customer.get(auth.customer_id);

    const data = {
      ...auth,
      company_name: customer.company_name,
      service_type_label: SERVICE_TYPE_LABELS[auth.service_type] || auth.service_type,
      authorization_date: auth.authorization_date
        ? new Date(auth.authorization_date).toLocaleDateString()
        : new Date().toLocaleDateString(),
    };

    const pdfBytes = buildAuthorizationPDF(data);
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #1e293b;">Service Authorization Confirmation</h2>
        <p>Dear ${auth.billing_contact_name || customer.company_name},</p>
        <p>Thank you for submitting your service authorization request. A copy of your signed authorization form is attached to this email for your records.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Customer:</strong> ${customer.company_name}</p>
          <p style="margin: 4px 0;"><strong>Service Type:</strong> ${SERVICE_TYPE_LABELS[auth.service_type] || auth.service_type || '—'}</p>
          <p style="margin: 4px 0;"><strong>Equipment:</strong> ${auth.equipment_info || '—'}</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${data.authorization_date}</p>
        </div>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Parts Deposit Reminder:</strong> A parts deposit equal to the cost of required parts will be collected before ordering. Our team will contact you with a parts estimate prior to ordering.</p>
        </div>
        <p>Our team will review your request and contact you shortly. If you have any questions, please reach out:</p>
        <p><strong>${COMPANY_NAME}</strong><br/>${COMPANY_PHONE}<br/>${COMPANY_EMAIL}</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 24px;">Your signed authorization form is attached as a PDF.</p>
      </div>
    `;

    const promises = [];

    // Email customer
    if (customer.email || auth.billing_contact_email) {
      promises.push(
        base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email || auth.billing_contact_email,
          subject: `Service Authorization Confirmation – ${customer.company_name}`,
          body: emailHtml,
        })
      );
    }

    // Email company
    if (COMPANY_EMAIL) {
      promises.push(
        base44.asServiceRole.integrations.Core.SendEmail({
          to: COMPANY_EMAIL,
          subject: `New Service Authorization – ${customer.company_name}`,
          body: `<div style="font-family: Arial, sans-serif;">
            <h2>New Service Authorization Submitted</h2>
            <p><strong>Customer:</strong> ${customer.company_name}</p>
            <p><strong>Contact:</strong> ${auth.billing_contact_name} – ${auth.billing_contact_phone}</p>
            <p><strong>Email:</strong> ${auth.billing_contact_email}</p>
            <p><strong>Service Type:</strong> ${SERVICE_TYPE_LABELS[auth.service_type] || auth.service_type}</p>
            <p><strong>Equipment:</strong> ${auth.equipment_info || '—'}</p>
            <p><strong>Description:</strong> ${auth.nature_of_service}</p>
          </div>`,
        })
      );
    }

    await Promise.all(promises);

    // Return PDF for download too
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=authorization-${auth.id.substring(0, 8)}.pdf`,
      },
    });
  } catch (error) {
    console.error('sendAuthorizationEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});