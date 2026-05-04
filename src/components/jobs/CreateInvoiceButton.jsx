import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Receipt, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

function generateInvoiceNumber() {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${date}-${random}`;
}

export default function CreateInvoiceButton({ job, existingInvoices = [] }) {
  const [loading, setLoading] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState(null);
  const navigate = useNavigate();

  // Find any existing invoice linked to this job
  const linkedInvoice = existingInvoices.find(inv => inv.job_id === job.id);

  const handleClick = async () => {
    if (linkedInvoice) {
      setExistingInvoice(linkedInvoice);
      return;
    }
    await createInvoice();
  };

  const createInvoice = async () => {
    setLoading(true);
    try {
      const sr = job.serviceReport;
      const parts = job.partsOrders || [];

      // Calculate labor total from service items
      const laborTotal = (sr?.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const travelTotal = sr?.destination_fee?.total || 0;

      // Calculate parts total with markup
      const partsTotal = parts.reduce((sum, p) => {
        const cost = (p.unit_cost || 0) * (p.quantity || 1);
        const shipping = ((p.shipping_cost || 0) / (p.quantity || 1));
        const costWithShipping = cost + (shipping * (p.quantity || 1));
        const markup = costWithShipping * ((p.markup_percent || 25) / 100);
        return sum + costWithShipping + markup;
      }, 0);

      // Build technical summary for notes
      const technicalSummary = buildTechnicalSummary(job, sr, parts);

      const invoiceData = {
        job_id: job.id,
        customer_id: job.customer_id,
        service_report_id: sr?.id || null,
        invoice_number: generateInvoiceNumber(),
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        labor_total: laborTotal,
        travel_total: travelTotal,
        parts_total: partsTotal,
        discount_percent: 0,
        tax_rate: 0,
        tax_amount: 0,
        ag_exempt: false,
        total_amount: laborTotal + travelTotal + partsTotal,
        status: 'draft',
        notes: technicalSummary,
        service_company: job.service_company || '',
      };

      const created = await base44.entities.Invoice.create(invoiceData);

      // Update job status to invoiced if not already
      if (!['invoiced', 'closed'].includes(job.status)) {
        await base44.entities.Job.update(job.id, { status: 'invoiced' });
      }

      toast.success('Invoice created! Redirecting to review...');

      // Navigate to invoices page with the new invoice pre-opened for editing
      navigate(`${createPageUrl('Invoices')}?open_invoice_id=${created.id}`);
    } catch (error) {
      toast.error('Failed to create invoice: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openExisting = () => {
    navigate(`${createPageUrl('Invoices')}?open_invoice_id=${linkedInvoice.id}`);
    setExistingInvoice(null);
  };

  return (
    <>
      {linkedInvoice ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          className="text-green-700 border-green-300 bg-green-50 hover:bg-green-100 text-xs"
        >
          <Receipt className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">View Invoice</span>
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleClick}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 sm:mr-1 animate-spin" />
          ) : (
            <Receipt className="w-4 h-4 sm:mr-1" />
          )}
          <span className="hidden sm:inline">{loading ? 'Creating...' : 'Create Invoice'}</span>
          <span className="sm:hidden">{loading ? '...' : 'Invoice'}</span>
        </Button>
      )}

      {/* Duplicate warning dialog */}
      <Dialog open={!!existingInvoice} onOpenChange={() => setExistingInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Invoice Already Exists
            </DialogTitle>
            <DialogDescription>
              An invoice ({linkedInvoice?.invoice_number}) has already been created for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setExistingInvoice(null)}>Cancel</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={openExisting}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildTechnicalSummary(job, sr, parts) {
  const lines = [];

  lines.push('=== TECHNICAL SERVICE SUMMARY ===');
  if (job.job_number) lines.push(`Job #: ${job.job_number}`);
  if (sr?.service_date) lines.push(`Service Date: ${format(new Date(sr.service_date), 'MMMM d, yyyy')}`);
  lines.push('');

  // Equipment info
  if (sr) {
    lines.push('--- EQUIPMENT ---');
    if (sr.equipment_type) lines.push(`Type: ${sr.equipment_type}`);
    if (sr.equipment_make) lines.push(`Make: ${sr.equipment_make}`);
    if (sr.equipment_model) lines.push(`Model: ${sr.equipment_model}`);
    if (sr.equipment_serial) lines.push(`Serial: ${sr.equipment_serial}`);
    if (sr.equipment_hours) lines.push(`Hours: ${sr.equipment_hours}`);
    lines.push('');
  }

  // Customer complaint
  if (sr?.complaint) {
    lines.push('--- CUSTOMER COMPLAINT ---');
    lines.push(sr.complaint);
    lines.push('');
  }

  // CAT Diagnostic steps
  if (sr?.cat_diagnostic) {
    const d = sr.cat_diagnostic;
    lines.push('--- DIAGNOSTIC FINDINGS ---');
    if (d.step1_verify_complaint) lines.push(`Verified Complaint: ${d.step1_verify_complaint}`);
    if (d.step2_initial_inspection) lines.push(`Initial Inspection: ${d.step2_initial_inspection}`);
    if (d.step3_list_causes) lines.push(`Possible Causes: ${d.step3_list_causes}`);
    if (d.step4_analyze_causes) lines.push(`Root Cause Analysis: ${d.step4_analyze_causes}`);
    if (d.step5_repair) lines.push(`Repair Performed: ${d.step5_repair}`);
    if (d.step6_verify_repair) lines.push(`Repair Verification: ${d.step6_verify_repair}`);
    lines.push('');
  }

  // Work performed
  if (sr?.work_performed) {
    lines.push('--- WORK PERFORMED ---');
    lines.push(sr.work_performed);
    lines.push('');
  }

  // Safety/precision notes
  if (sr?.safety_precision_notes) {
    lines.push('--- PRECISION/SAFETY NOTES ---');
    lines.push(sr.safety_precision_notes);
    lines.push('');
  }

  // Labor line items
  if (sr?.service_items?.length > 0) {
    lines.push('--- LABOR ITEMS ---');
    sr.service_items.forEach(item => {
      lines.push(`  • ${item.description || 'Labor'} — ${item.hours || 0} hrs @ $${item.rate || 0}/hr = $${(item.total || 0).toFixed(2)}`);
    });
    lines.push('');
  }

  // Parts used
  if (parts.length > 0) {
    lines.push('--- PARTS USED ---');
    parts.forEach(p => {
      const unitCost = p.unit_cost || 0;
      const qty = p.quantity || 1;
      const shipping = p.shipping_cost || 0;
      const baseCost = unitCost * qty + shipping;
      const markup = baseCost * ((p.markup_percent || 25) / 100);
      const total = baseCost + markup;
      lines.push(`  • ${p.part_description}${p.part_number ? ` (PN: ${p.part_number})` : ''} — Qty: ${qty} @ $${unitCost.toFixed(2)} + ${p.markup_percent || 25}% markup = $${total.toFixed(2)}`);
      if (p.verification_source) lines.push(`    Source: ${p.verification_source}${p.verification_details ? ` — ${p.verification_details}` : ''}`);
    });
    lines.push('');
  }

  if (sr?.notes) {
    lines.push('--- ADDITIONAL NOTES ---');
    lines.push(sr.notes);
    lines.push('');
  }

  return lines.join('\n');
}