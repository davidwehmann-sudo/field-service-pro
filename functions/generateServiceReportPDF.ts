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

    const { report_id } = await req.json();

    if (!report_id) {
      return Response.json({ error: 'Report ID required' }, { status: 400 });
    }

    // Fetch report and customer
    const report = await base44.entities.ServiceReport.get(report_id);
    const customer = await base44.entities.Customer.get(report.customer_id);

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('SERVICE REPORT', 20, y);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${new Date(report.service_date).toLocaleDateString()}`, pageWidth - 20, y, { align: 'right' });
    doc.text(`Report ID: ${report.id.substring(0, 8)}`, pageWidth - 20, y + 5, { align: 'right' });
    
    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Customer info
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('CUSTOMER', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(customer.company_name || customer.contact_name, 20, y);
    y += 5;
    if (customer.address) {
      doc.text(customer.address, 20, y);
      y += 5;
      doc.text(`${customer.city}, ${customer.state} ${customer.zip || ''}`, 20, y);
      y += 5;
    }
    if (customer.phone) {
      doc.text(`Phone: ${customer.phone}`, 20, y);
      y += 5;
    }

    y += 8;

    // Equipment info
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('EQUIPMENT', 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`Type: ${report.equipment_type || 'N/A'}`, 20, y);
    y += 5;
    if (report.equipment_make) {
      doc.text(`Make: ${report.equipment_make}`, 20, y);
      y += 5;
    }
    if (report.equipment_model) {
      doc.text(`Model: ${report.equipment_model}`, 20, y);
      y += 5;
    }
    if (report.equipment_serial) {
      doc.text(`Serial: ${report.equipment_serial}`, 20, y);
      y += 5;
    }
    if (report.equipment_hours) {
      doc.text(`Hours: ${report.equipment_hours}`, 20, y);
      y += 5;
    }

    y += 8;

    // Complaint
    if (report.complaint) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('CUSTOMER COMPLAINT', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const complaintLines = doc.splitTextToSize(report.complaint, pageWidth - 40);
      doc.text(complaintLines, 20, y);
      y += complaintLines.length * 5 + 5;
    }

    // CAT Diagnostic (if present)
    if (report.cat_diagnostic && Object.keys(report.cat_diagnostic).length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('DIAGNOSTIC PROCESS', 20, y);
      y += 7;
      doc.setFontSize(8);
      
      const diagnosticSteps = {
        'step1_symptom': '1. Symptom',
        'step2_research': '2. Research',
        'step3_visual_inspection': '3. Visual Inspection',
        'step4_operational_tests': '4. Operational Tests',
        'step5_diagnostic_codes': '5. Diagnostic Codes',
        'step6_measurements': '6. Measurements',
        'step7_root_cause': '7. Root Cause'
      };

      for (const [key, label] of Object.entries(diagnosticSteps)) {
        if (report.cat_diagnostic[key]) {
          doc.setFont(undefined, 'bold');
          doc.text(label, 20, y);
          y += 4;
          doc.setFont(undefined, 'normal');
          const lines = doc.splitTextToSize(report.cat_diagnostic[key], pageWidth - 40);
          doc.text(lines, 20, y);
          y += lines.length * 4 + 3;
        }
      }
      y += 3;
    }

    // Work Performed
    if (report.work_performed) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('WORK PERFORMED', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const workLines = doc.splitTextToSize(report.work_performed, pageWidth - 40);
      doc.text(workLines, 20, y);
      y += workLines.length * 5 + 5;
    }

    // Service Items using autoTable for automatic page breaks
    if (report.service_items && report.service_items.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('BILLABLE ITEMS', 20, y);
      y += 7;

      const serviceRows = report.service_items.map(item => {
        const total = item.total || (item.hours * item.rate);
        return [
          item.description || '',
          (item.hours || 0).toString(),
          `$${(item.rate || 0).toFixed(2)}`,
          `$${total.toFixed(2)}`
        ];
      });

      const serviceTotal = report.service_items.reduce((sum, item) => 
        sum + (item.total || (item.hours * item.rate)), 0
      );

      doc.autoTable({
        startY: y,
        head: [['Description', 'Hours', 'Rate', 'Total']],
        body: serviceRows,
        foot: [['', '', 'Labor Total:', `$${serviceTotal.toFixed(2)}`]],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { textColor: [100, 100, 100], fontStyle: 'normal' },
        footStyles: { fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 30 }
        },
        margin: { left: 20, right: 20 }
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // Destination Fee
    if (report.destination_fee && report.destination_fee.total > 0) {
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text('TRAVEL / DESTINATION', 20, y);
      y += 7;
      doc.setFontSize(9);
      
      if (report.destination_fee.mileage) {
        doc.text(`Mileage: ${report.destination_fee.mileage} miles @ $${report.destination_fee.mileage_rate}/mile`, 20, y);
        y += 5;
      }
      if (report.destination_fee.travel_hours) {
        doc.text(`Travel Time: ${report.destination_fee.travel_hours} hrs @ $${report.destination_fee.travel_rate}/hr`, 20, y);
        y += 5;
      }
      if (report.destination_fee.condition_surcharge > 0) {
        doc.text(`Location Surcharge: $${report.destination_fee.condition_surcharge.toFixed(2)}`, 20, y);
        y += 5;
      }
      
      y += 2;
      doc.setFont(undefined, 'bold');
      doc.text(`Destination Total: $${report.destination_fee.total.toFixed(2)}`, 20, y);
      doc.setFont(undefined, 'normal');
      y += 8;
    }

    // Notes
    if (report.notes) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Additional Notes:', 20, y);
      y += 5;
      const noteLines = doc.splitTextToSize(report.notes, pageWidth - 40);
      doc.text(noteLines, 20, y);
      y += noteLines.length * 5 + 5;
    }

    // Signature (if present)
    if (report.customer_signature) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.text('Customer Signature:', 20, y);
      y += 5;
      // Add signature image if it's a data URL
      if (report.customer_signature.startsWith('data:image')) {
        try {
          doc.addImage(report.customer_signature, 'PNG', 20, y, 60, 20);
          y += 25;
        } catch (e) {
          doc.text('[Signature on file]', 20, y);
          y += 7;
        }
      } else {
        doc.text('[Signature on file]', 20, y);
        y += 7;
      }
    }

    // Return PDF
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=service-report-${report.id.substring(0, 8)}.pdf`
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});