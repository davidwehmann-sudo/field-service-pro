import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return Response.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Fetch all job-related data
    const job = await base44.entities.Job.get(job_id);
    const customer = await base44.entities.Customer.get(job.customer_id);
    
    const [authorizations, serviceReports, partsOrders, invoices, payments] = await Promise.all([
      base44.entities.PreRepairAuthorization.filter({ job_id }),
      base44.entities.ServiceReport.filter({ job_id }),
      base44.entities.PartsOrder.filter({ job_id }),
      base44.entities.Invoice.filter({ job_id }),
      base44.entities.Payment.filter({ job_id })
    ]);

    const authorization = authorizations[0] || null;
    const serviceReport = serviceReports[0] || null;
    const invoice = invoices[0] || null;

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    // Helper function to check if we need a new page
    const checkPageBreak = (spaceNeeded = 30) => {
      if (y + spaceNeeded > pageHeight - 20) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // ========== HEADER ==========
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('COMPLETE JOB REPORT', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Job Number: ${job.job_number || 'Pending'}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // ========== CUSTOMER INFO ==========
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('CUSTOMER INFORMATION', 20, y);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(customer.company_name || customer.contact_name || 'N/A', 20, y);
    y += 5;
    if (customer.contact_name) {
      doc.text(`Contact: ${customer.contact_name}`, 20, y);
      y += 5;
    }
    if (customer.address) {
      doc.text(customer.address, 20, y);
      y += 5;
      doc.text(`${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`, 20, y);
      y += 5;
    }
    if (customer.phone) {
      doc.text(`Phone: ${customer.phone}`, 20, y);
      y += 5;
    }
    if (customer.email) {
      doc.text(`Email: ${customer.email}`, 20, y);
      y += 5;
    }
    y += 8;

    // ========== PRE-REPAIR AUTHORIZATION ==========
    if (authorization) {
      checkPageBreak(40);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('PRE-REPAIR AUTHORIZATION', 20, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      
      if (authorization.service_type) {
        doc.text(`Service Type: ${authorization.service_type.replace(/_/g, ' ')}`, 20, y);
        y += 5;
      }
      
      if (authorization.nature_of_service) {
        doc.setFont(undefined, 'bold');
        doc.text('Nature of Service:', 20, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        const natureLines = doc.splitTextToSize(authorization.nature_of_service, pageWidth - 40);
        doc.text(natureLines, 20, y);
        y += natureLines.length * 4 + 4;
      }
      
      if (authorization.equipment_info) {
        doc.text(`Equipment: ${authorization.equipment_info}`, 20, y);
        y += 5;
      }
      
      if (authorization.parts_payment_required) {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(200, 100, 0);
        doc.text('⚠ Parts Payment Required Upfront', 20, y);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        y += 5;
      }
      
      if (authorization.authorization_date) {
        doc.text(`Authorized: ${new Date(authorization.authorization_date).toLocaleDateString()}`, 20, y);
        y += 5;
      }
      
      y += 8;
    }

    // ========== SERVICE REPORT ==========
    if (serviceReport) {
      checkPageBreak(50);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('SERVICE REPORT', 20, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Service Date: ${new Date(serviceReport.service_date).toLocaleDateString()}`, 20, y);
      y += 5;

      // Equipment Info
      doc.setFont(undefined, 'bold');
      doc.text('Equipment:', 20, y);
      y += 4;
      doc.setFont(undefined, 'normal');
      doc.text(`Type: ${serviceReport.equipment_type || 'N/A'}`, 25, y);
      y += 4;
      if (serviceReport.equipment_make) {
        doc.text(`Make: ${serviceReport.equipment_make}`, 25, y);
        y += 4;
      }
      if (serviceReport.equipment_model) {
        doc.text(`Model: ${serviceReport.equipment_model}`, 25, y);
        y += 4;
      }
      if (serviceReport.equipment_serial) {
        doc.text(`Serial: ${serviceReport.equipment_serial}`, 25, y);
        y += 4;
      }
      if (serviceReport.equipment_hours) {
        doc.text(`Hours: ${serviceReport.equipment_hours}`, 25, y);
        y += 4;
      }
      y += 4;

      // Complaint
      if (serviceReport.complaint) {
        checkPageBreak(20);
        doc.setFont(undefined, 'bold');
        doc.text('Customer Complaint:', 20, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        const complaintLines = doc.splitTextToSize(serviceReport.complaint, pageWidth - 40);
        doc.text(complaintLines, 20, y);
        y += complaintLines.length * 4 + 4;
      }

      // CAT Diagnostic
      if (serviceReport.cat_diagnostic && Object.keys(serviceReport.cat_diagnostic).length > 0) {
        checkPageBreak(30);
        doc.setFont(undefined, 'bold');
        doc.text('Diagnostic Process:', 20, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        
        const diagnosticSteps = {
          'step1_verify_complaint': '1. Verify Complaint',
          'step2_initial_inspection': '2. Initial Inspection',
          'step3_list_causes': '3. List Possible Causes',
          'step4_analyze_causes': '4. Analyze Causes',
          'step5_repair': '5. Repair',
          'step6_verify_repair': '6. Verify Repair',
          'step7_document': '7. Document'
        };

        for (const [key, label] of Object.entries(diagnosticSteps)) {
          if (serviceReport.cat_diagnostic[key]) {
            checkPageBreak(15);
            doc.setFont(undefined, 'bold');
            doc.text(label, 20, y);
            y += 4;
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(serviceReport.cat_diagnostic[key], pageWidth - 40);
            doc.text(lines, 25, y);
            y += lines.length * 4 + 3;
          }
        }
        y += 3;
      }

      // Work Performed
      if (serviceReport.work_performed) {
        checkPageBreak(20);
        doc.setFont(undefined, 'bold');
        doc.text('Work Performed:', 20, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        const workLines = doc.splitTextToSize(serviceReport.work_performed, pageWidth - 40);
        doc.text(workLines, 20, y);
        y += workLines.length * 4 + 5;
      }

      y += 5;
    }

    // ========== PARTS ORDERS ==========
    if (partsOrders.length > 0) {
      checkPageBreak(40);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('PARTS USED', 20, y);
      y += 7;
      
      // Table header
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Description', 20, y);
      doc.text('Part #', 95, y);
      doc.text('Qty', 135, y);
      doc.text('Supplier', 150, y);
      y += 4;
      doc.line(20, y, pageWidth - 20, y);
      y += 4;
      
      doc.setTextColor(40, 40, 40);
      for (const part of partsOrders) {
        checkPageBreak(15);
        
        doc.text(part.part_description || 'N/A', 20, y, { maxWidth: 70 });
        doc.text(part.part_number || 'N/A', 95, y);
        doc.text((part.quantity || 0).toString(), 135, y);
        doc.text(part.supplier || 'N/A', 150, y);
        y += 4;
        
        // Verification info (if present)
        if (part.verification_source || part.verification_details) {
          doc.setFontSize(7);
          doc.setTextColor(50, 100, 200);
          if (part.verification_source) {
            doc.text(`✓ Verified: ${part.verification_source}`, 25, y);
            y += 3;
          }
          if (part.verification_details) {
            doc.text(`  ${part.verification_details}`, 25, y);
            y += 3;
          }
          doc.setFontSize(8);
          doc.setTextColor(40, 40, 40);
        }
        
        y += 2;
      }
      
      y += 8;
    }

    // ========== INVOICE SUMMARY ==========
    if (invoice) {
      checkPageBreak(50);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('INVOICE SUMMARY', 20, y);
      y += 7;
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text(`Invoice #: ${invoice.invoice_number || 'N/A'}`, 20, y);
      y += 5;
      doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 20, y);
      y += 8;
      
      // Line items
      doc.setTextColor(100, 100, 100);
      doc.text('Description', 20, y);
      doc.text('Amount', pageWidth - 20, y, { align: 'right' });
      y += 4;
      doc.line(20, y, pageWidth - 20, y);
      y += 5;
      
      doc.setTextColor(40, 40, 40);
      
      if (invoice.labor_total > 0) {
        doc.text('Labor', 20, y);
        doc.text(`$${invoice.labor_total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
      }
      
      if (invoice.travel_total > 0) {
        doc.text('Travel/Destination', 20, y);
        doc.text(`$${invoice.travel_total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
      }
      
      if (invoice.parts_total > 0) {
        doc.text('Parts', 20, y);
        doc.text(`$${invoice.parts_total.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
      }
      
      y += 2;
      const subtotal = (invoice.labor_total || 0) + (invoice.travel_total || 0) + (invoice.parts_total || 0);
      doc.text('Subtotal', 20, y);
      doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      y += 5;
      
      if (invoice.discount_percent > 0) {
        const discount = subtotal * (invoice.discount_percent / 100);
        doc.setTextColor(200, 0, 0);
        doc.text(`Discount (${invoice.discount_percent}%)`, 20, y);
        doc.text(`-$${discount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        doc.setTextColor(40, 40, 40);
        y += 5;
      }
      
      if (invoice.tax_amount > 0) {
        doc.text(`Sales Tax (${invoice.tax_rate}%)`, 20, y);
        doc.text(`$${invoice.tax_amount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
      }
      
      if (invoice.ag_exempt) {
        doc.setFontSize(8);
        doc.setTextColor(0, 150, 0);
        doc.text('✓ Agricultural Exemption Applied', 20, y);
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        y += 5;
      }
      
      y += 2;
      doc.line(20, y, pageWidth - 20, y);
      y += 5;
      
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('TOTAL', 20, y);
      doc.text(`$${invoice.total_amount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      y += 8;
      
      // Payment status
      if (invoice.status === 'paid') {
        doc.setTextColor(0, 150, 0);
        doc.text('✓ PAID IN FULL', 20, y);
        if (invoice.payment_date) {
          doc.text(`Payment Date: ${new Date(invoice.payment_date).toLocaleDateString()}`, 20, y + 4);
          y += 4;
        }
        if (invoice.payment_method) {
          doc.text(`Method: ${invoice.payment_method}`, 20, y + 4);
          y += 4;
        }
      } else {
        doc.setTextColor(200, 100, 0);
        doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, y);
      }
      doc.setTextColor(40, 40, 40);
      y += 8;
    }

    // ========== PAYMENT LOG ==========
    if (payments.length > 0) {
      checkPageBreak(30);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('PAYMENT HISTORY', 20, y);
      y += 7;
      
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Date', 20, y);
      doc.text('Type', 70, y);
      doc.text('Method', 120, y);
      doc.text('Amount', pageWidth - 20, y, { align: 'right' });
      y += 4;
      doc.line(20, y, pageWidth - 20, y);
      y += 4;
      
      doc.setTextColor(40, 40, 40);
      for (const payment of payments) {
        checkPageBreak(8);
        doc.text(new Date(payment.payment_date).toLocaleDateString(), 20, y);
        doc.text(payment.payment_type.replace(/_/g, ' '), 70, y);
        doc.text(payment.payment_method || 'N/A', 120, y);
        doc.text(`$${payment.amount.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
        y += 5;
      }
      
      y += 3;
      doc.line(20, y, pageWidth - 20, y);
      y += 5;
      
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      doc.setFont(undefined, 'bold');
      doc.text('Total Paid', 20, y);
      doc.text(`$${totalPaid.toFixed(2)}`, pageWidth - 20, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
    }

    // ========== FOOTER ==========
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount} • ${job.job_number || 'Job'} • Generated ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Return PDF
    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=job-${job.job_number || job.id.substring(0, 8)}-complete.pdf`
      }
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});