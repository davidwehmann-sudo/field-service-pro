import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@2.5.2';

const COMPANY_NAME = 'Wehmann Equipment Service';
const COMPANY_PHONE = '(Your Phone)';
const COMPANY_EMAIL = 'office@wehmanntexas.com';

Deno.serve(async (req) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const colRight = pageWidth - margin;
    const bottomMargin = 20;
    let y = 20;

    const addFooter = () => {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont(undefined, 'normal');
      doc.text(
        `${COMPANY_NAME}  |  ${COMPANY_PHONE}  |  ${COMPANY_EMAIL}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    };

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > pageHeight - bottomMargin - 10) {
        addFooter();
        doc.addPage();
        y = 20;
      }
    };

    const section = (title) => {
      checkPageBreak(16);
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, colRight - margin, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text(title, margin + 3, y + 5.5);
      y += 12;
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'normal');
    };

    const blankLine = (label) => {
      checkPageBreak(10);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(label + ':', margin, y);
      doc.setFont(undefined, 'normal');
      doc.setDrawColor(150, 150, 150);
      doc.line(margin + 38, y + 1, colRight, y + 1);
      y += 8;
    };

    const blankBox = (label, height = 20) => {
      checkPageBreak(height + 12);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(label + ':', margin, y);
      y += 4;
      doc.setDrawColor(150, 150, 150);
      doc.rect(margin, y, colRight - margin, height);
      y += height + 5;
    };

    // ── Header ──────────────────────────────────────────────────────────────
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
    doc.setTextColor(30, 41, 59);
    doc.text('Date: ___________________________', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, colRight, y);
    y += 6;

    // ── Customer & Billing ───────────────────────────────────────────────────
    section('Customer & Billing Information');
    blankLine('Customer / Company Name');
    blankLine('Billing Contact Name');
    blankLine('Phone');
    blankLine('Email');
    blankLine('Address');
    blankLine('City / State / ZIP');
    y += 2;

    // ── On-Site Contact ──────────────────────────────────────────────────────
    section('On-Site Contact (if different)');
    blankLine('Contact Name');
    blankLine('Phone');
    y += 2;

    // ── Service Details ──────────────────────────────────────────────────────
    section('Service Details');
    checkPageBreak(10);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Service Type (circle one):', margin, y);
    y += 6;
    doc.setFont(undefined, 'normal');
    doc.text('Check & Advise     Consultation     Diagnostic     Repair     Preventive Maintenance     Emergency', margin + 2, y);
    y += 8;
    blankLine('Equipment / Unit Info (Make, Model, Serial)');
    blankBox('Description of Problem / Service Needed', 28);

    // ── Billing Structure ────────────────────────────────────────────────────
    section('Billing Structure');
    const billingLines = [
      '• All Services: $200/hr (3-hour minimum)',
      '• Travel/destination fees based on location',
      '• Parts billed at cost + standard markup',
      '• General technician supplies fee: starts at $35 (may increase for demanding jobs)',
      '• Sales tax applied where applicable',
    ];
    for (const line of billingLines) {
      checkPageBreak(7);
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(line, margin + 2, y);
      y += 5.5;
    }
    y += 2;
    checkPageBreak(10);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('Customer Initials (acknowledging billing structure): _________', margin, y);
    y += 9;

    // ── Parts Deposit ────────────────────────────────────────────────────────
    section('Parts Deposit Notice');
    const depositText = 'A parts deposit equal to the cost of required parts will be collected prior to ordering. Work will not proceed until the parts deposit has been received.';
    const depositLines = doc.splitTextToSize(depositText, colRight - margin - 5);
    checkPageBreak(depositLines.length * 5 + 14);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(depositLines, margin, y);
    y += depositLines.length * 5 + 4;
    blankLine('Parts / Deposit Notes (optional)');
    y += 2;

    // ── Additional Notes ─────────────────────────────────────────────────────
    blankBox('Additional Notes', 20);

    // ── Authorization Signature ──────────────────────────────────────────────
    section('Authorization Signature');
    const authText = 'By signing below, I authorize inspection, diagnosis, and repair as described above, and agree to pay for actual services rendered and parts used.';
    const authLines = doc.splitTextToSize(authText, colRight - margin - 5);
    checkPageBreak(authLines.length * 5 + 30);
    doc.setFontSize(8.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(authLines, margin, y);
    y += authLines.length * 5 + 10;

    doc.setDrawColor(30, 41, 59);
    doc.line(margin, y, margin + 80, y);
    doc.line(margin + 90, y, margin + 150, y);
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Customer Signature', margin, y);
    doc.text('Date', margin + 90, y);

    // Footer on last page
    addFooter();

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=service-authorization-blank.pdf',
      },
    });
  } catch (error) {
    console.error('generateBlankAuthorizationForm error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});