import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Send, DollarSign, Sparkles, Wand2, Eye, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import CustomerSelect from '@/components/customers/CustomerSelect';
import PhotoUpload from '@/components/service/PhotoUpload';
import SignaturePad from '@/components/ui/SignaturePad';
import CatDiagnosticForm from '@/components/service/CatDiagnosticForm';
import ServiceItemsEditor from '@/components/service/ServiceItemsEditor';
import DestinationFeeEditor from '@/components/service/DestinationFeeEditor';
import OfflineIndicator from '@/components/service/OfflineIndicator';
import OriginalNotesViewer from '@/components/service/OriginalNotesViewer';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const EQUIPMENT_TYPES = [
  'Auger',
  'Baler',
  'Bulldozer',
  'Combine Harvester',
  'Compressor',
  'Crane',
  'Cultivator',
  'Disc Harrow',
  'Excavator',
  'Forklift',
  'Generator',
  'Grain Cart',
  'Grain Dryer',
  'Irrigation System',
  'Loader',
  'Plow',
  'Planter',
  'Pump',
  'Semi Truck',
  'Sprayer',
  'Tractor',
  'Trailer',
  'Other'
];

export default function ServiceReportForm({ 
  report, 
  customers, 
  onSave, 
  onComplete,
  onBack,
  isSaving 
}) {
  const storageKey = `service_report_draft_${report?.id || 'new'}`;

  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [formattingNotes, setFormattingNotes] = useState(false);
  const [showOriginalNotes, setShowOriginalNotes] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const [formData, setFormData] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem(storageKey);
    if (saved && !report?.id) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return {
      job_id: '',
      customer_id: '',
      is_internal: false,
      service_date: format(new Date(), 'yyyy-MM-dd'),
      equipment_type: '',
      equipment_make: '',
      equipment_model: '',
      equipment_serial: '',
      equipment_hours: '',
      complaint: '',
      technician_notes: '',
      cat_diagnostic: {},
      work_performed: '',
      service_items: [],
      destination_fee: {
        mileage: '',
        mileage_rate: '0.65',
        travel_hours: '',
        travel_rate: '75',
        location_condition: 'standard',
        condition_surcharge: 0,
        total: 0
      },
      photos: [],
      customer_signature: '',
      notes: '',
      status: 'open',
      ...report
    };
  });

  // Auto-save to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData, storageKey]);

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleFormatNotes = useCallback(async () => {
    if (!formData.technician_notes?.trim()) {
      toast.error('Please enter technician notes first');
      return;
    }

    setFormattingNotes(true);
    try {
      const result = await base44.functions.invoke('grokAssistant', {
        prompt: `Convert the following raw technician notes into a professional, organized format:

${formData.technician_notes}

Requirements:
1. Segment into logical service categories (e.g., Disassembly, Inspection, Adjustments, Repairs, Reassembly, Testing)
2. Use bullet points for each category
3. Format with **bold** for action verbs (e.g., **Split**, **Inspected**, **Adjusted**, **Replaced**)
4. Format with *italics* for technical specifications and measurements (e.g., *0.015 Intake*, *0.023 Exhaust*)
5. Keep the language concise and professional
6. Preserve all technical details and measurements

Example transformation:
Input: "split tractor, inspect shaft, adjusted overhead to 0.015 Intake 0.023 exhaust"
Output:
**Disassembly:**
• **Split** tractor to access internal components

**Inspection:**
• **Inspected** shaft for wear and damage

**Adjustments:**
• **Adjusted** overhead clearance to *0.015" Intake / 0.023" Exhaust*

Return only the formatted text, no explanations.`,
        maxTokens: 1500
      });

      if (result.data?.text) {
        handleChange('technician_notes', result.data.text);
        toast.success('Notes formatted successfully');
      }
    } catch (error) {
      toast.error('Formatting failed: ' + error.message);
    } finally {
      setFormattingNotes(false);
    }
  }, [formData.technician_notes, handleChange]);

  const handleFormatAndCompile = useCallback(async () => {
    if (!formData.technician_notes?.trim()) {
      toast.error('Please enter technician notes first');
      return;
    }

    setFormattingNotes(true);
    setAiProcessing(true);
    
    try {
      // Preserve original notes if not already saved
      if (!formData.original_technician_notes) {
        setFormData(prev => ({ 
          ...prev, 
          original_technician_notes: formData.technician_notes 
        }));
      }

      // Step 1: Format notes
      toast.info('Step 1: Formatting notes...');
      const formatResult = await base44.functions.invoke('grokAssistant', {
        prompt: `Convert the following raw technician notes into a professional, organized format:

${formData.technician_notes}

Requirements:
1. Segment into logical service categories (e.g., Disassembly, Inspection, Adjustments, Repairs, Reassembly, Testing)
2. Use bullet points for each category
3. Format with **bold** for action verbs (e.g., **Split**, **Inspected**, **Adjusted**, **Replaced**)
4. Format with *italics* for technical specifications and measurements (e.g., *0.015 Intake*, *0.023 Exhaust*)
5. Keep the language concise and professional
6. Preserve all technical details and measurements

Example transformation:
Input: "split tractor, inspect shaft, adjusted overhead to 0.015 Intake 0.023 exhaust"
Output:
**Disassembly:**
• **Split** tractor to access internal components

**Inspection:**
• **Inspected** shaft for wear and damage

**Adjustments:**
• **Adjusted** overhead clearance to *0.015" Intake / 0.023" Exhaust*

Return only the formatted text, no explanations.`,
        maxTokens: 1500
      });

      let formattedNotes = formData.technician_notes;
      if (formatResult.data?.text) {
        formattedNotes = formatResult.data.text;
        setFormData(prev => ({ ...prev, technician_notes: formattedNotes }));
        toast.success('Notes formatted ✓');
      }

      setFormattingNotes(false);

      // Step 2: Compile report using formatted notes
      toast.info('Step 2: Compiling full report...');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a field service technician documentation assistant. Generate a complete service report using the official Caterpillar 7-Step Diagnostic Process.

CATERPILLAR 7-STEP PROCESS:
1. Verify Customer Complaint
2. Conduct Initial Inspection (pictures as necessary)
3. List Possible Causes
4. Analyze Possible Causes / Determine Root Cause
5. Repair Root Cause
6. Verify Repair (pictures as necessary)
7. Document [concern], [analysis], & [repair] in Service Report

IMPORTANT: Review ALL technician notes comprehensively. Consider the complete context from all notes entered, not just the latest addition.

Current Information:
- ALL Technician Notes: ${formattedNotes}
- Equipment: ${formData.equipment_type} ${formData.equipment_make} ${formData.equipment_model}
- Customer Complaint: ${formData.complaint}
- Photos Provided: ${formData.photos?.length || 0}
- Equipment Hours: ${formData.equipment_hours || 'Not provided'}
- Existing Diagnostic Work: ${Object.values(formData.cat_diagnostic || {}).filter(v => v).length > 0 ? 'Yes - update/refine existing entries' : 'No - generate fresh'}

ALWAYS provide:
1. step1_verify_complaint - Confirm and verify the customer's complaint
2. step2_initial_inspection - Initial inspection findings (note if pictures were taken)
3. step3_list_causes - List all possible causes identified
4. step4_analyze_causes - Analysis of causes and determination of root cause
5. step5_repair - Repairs performed to address root cause
6. step6_verify_repair - Verification testing and results (note if pictures taken)
7. step7_document - Final documentation summary
8. work_performed - Detailed description of repairs/work completed
9. billable_service_items - Break down work into distinct billable segments. IMPORTANT: Combine related operations on the SAME line to reduce line count:
   - "Remove and reinstall hydraulic pump" (not separate remove/install lines)
   - "Remove and replace damaged cylinder seal" (combines remove + replace for damaged part)
   - "Remove, repair, and reinstall fuel injector" (combines all steps)
   Use combined descriptions whenever removal and reinstallation go together. Only separate if truly independent tasks.
   CRITICAL: When combining operations, estimate hours for ALL combined steps (e.g., "Remove and reinstall pump" should include time for both removal AND reinstallation).

SELF-AUDIT: Before finalizing, verify:
- All tech notes have been considered
- Diagnostic steps follow CAT 7-Step Process
- Work performed aligns with diagnostic findings
- Billable items cover all work mentioned
- No contradictions in the report

IF additional information would significantly improve the report, list it in suggested_additional_info.

Generate the best report possible with available information.`,
        response_json_schema: {
          type: "object",
          properties: {
            step1_verify_complaint: { type: "string" },
            step2_initial_inspection: { type: "string" },
            step3_list_causes: { type: "string" },
            step4_analyze_causes: { type: "string" },
            step5_repair: { type: "string" },
            step6_verify_repair: { type: "string" },
            step7_document: { type: "string" },
            work_performed: { type: "string" },
            billable_service_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  hours: { type: "number" }
                }
              }
            },
            suggested_additional_info: { 
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setFormData(prev => ({
        ...prev,
        cat_diagnostic: {
          ...prev.cat_diagnostic,
          step1_verify_complaint: result.step1_verify_complaint,
          step2_initial_inspection: result.step2_initial_inspection,
          step3_list_causes: result.step3_list_causes,
          step4_analyze_causes: result.step4_analyze_causes,
          step5_repair: result.step5_repair,
          step6_verify_repair: result.step6_verify_repair,
          step7_document: result.step7_document
        },
        work_performed: result.work_performed,
        service_items: result.billable_service_items?.map(item => ({
          description: item.description,
          hours: item.hours,
          rate: prev.service_items?.[0]?.rate || 0,
          total: item.hours * (prev.service_items?.[0]?.rate || 0)
        })) || prev.service_items || []
      }));
      
      setAiSuggestions(result.suggested_additional_info?.length > 0 ? result.suggested_additional_info : null);
      toast.success('Report compiled successfully ✓');
    } catch (error) {
      toast.error('Processing failed: ' + error.message);
    } finally {
      setFormattingNotes(false);
      setAiProcessing(false);
    }
  }, [formData]);

  const totals = useMemo(() => {
    const serviceTotal = (formData.service_items || []).reduce(
      (sum, item) => sum + (item.total || 0), 0
    );
    const destinationTotal = formData.destination_fee?.total || 0;
    return { serviceTotal, destinationTotal, grandTotal: serviceTotal + destinationTotal };
  }, [formData.service_items, formData.destination_fee]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => !formData.customer_id || j.customer_id === formData.customer_id);
  }, [jobs, formData.customer_id]);

  const handleSave = useCallback(async (status = 'open') => {
    const data = {
      ...formData,
      status,
      equipment_hours: formData.equipment_hours ? parseFloat(formData.equipment_hours) : null,
    };
    
    try {
      if (status === 'completed') {
        await onComplete(data);
      } else {
        await onSave(data);
      }
      // Clear localStorage after successful save
      localStorage.removeItem(storageKey);
    } catch (error) {
      // Keep in localStorage if save fails
      console.error('Save failed, data preserved locally');
    }
  }, [formData, onSave, onComplete, storageKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {report?.id ? 'Edit Service Report' : 'New Service Report'}
          </h2>
          <p className="text-sm text-slate-500">Fill in the service details</p>
        </div>
        <OfflineIndicator />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleSave('open')}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save as Open
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              if (window.confirm('⚠️ Mark as Complete?\n\nThis will finalize the report and redirect you to create an invoice.\n\nClick OK to proceed, or Cancel to continue editing.')) {
                handleSave('completed');
              }
            }}
            disabled={isSaving || !formData.customer_id}
          >
            <Send className="w-4 h-4 mr-2" />
            Complete & Invoice
          </Button>
        </div>
      </div>

      {/* Totals Summary Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-400">Service Items</p>
            <p className="text-lg font-semibold">${totals.serviceTotal.toFixed(2)}</p>
          </div>
          <div className="text-slate-600">+</div>
          <div>
            <p className="text-xs text-slate-400">Destination</p>
            <p className="text-lg font-semibold">${totals.destinationTotal.toFixed(2)}</p>
          </div>
          <div className="text-slate-600">=</div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-2xl font-bold text-amber-400">${totals.grandTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customer & Equipment */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Customer & Equipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <CustomerSelect 
                customers={customers}
                value={formData.customer_id}
                onChange={(val) => handleChange('customer_id', val)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" />
                <div>
                  <Label className="text-sm font-medium">Internal Work</Label>
                  <p className="text-xs text-slate-500">For company equipment/non-billable</p>
                </div>
              </div>
              <Switch
                checked={formData.is_internal}
                onCheckedChange={(val) => handleChange('is_internal', val)}
              />
            </div>

            <div>
              <Label>Link to Job (Optional)</Label>
              <Select 
                value={formData.job_id || 'none'}
                onValueChange={(val) => handleChange('job_id', val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Create new job or link existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Create New Job</SelectItem>
                  {filteredJobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.job_number} - {customers.find(c => c.id === job.customer_id)?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Date</Label>
              <Input 
                type="date"
                value={formData.service_date}
                onChange={(e) => handleChange('service_date', e.target.value)}
              />
            </div>

            <div>
              <Label>Equipment Type</Label>
              <Select 
                value={formData.equipment_type}
                onValueChange={(val) => handleChange('equipment_type', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Make</Label>
                <Input 
                  value={formData.equipment_make}
                  onChange={(e) => handleChange('equipment_make', e.target.value)}
                  placeholder="Caterpillar"
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input 
                  value={formData.equipment_model}
                  onChange={(e) => handleChange('equipment_model', e.target.value)}
                  placeholder="D6T"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Serial Number</Label>
                <Input 
                  value={formData.equipment_serial}
                  onChange={(e) => handleChange('equipment_serial', e.target.value)}
                />
              </div>
              <div>
                <Label>Hour Meter</Label>
                <Input 
                  type="number"
                  value={formData.equipment_hours}
                  onChange={(e) => handleChange('equipment_hours', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technician Notes - Always Visible */}
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Technician Notes
              <Badge variant="outline" className="text-xs font-normal">Keep adding notes as you work</Badge>
            </CardTitle>
            <div className="flex gap-2">
              {formData.original_technician_notes && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowOriginalNotes(true)}
                  className="gap-2 text-blue-600"
                >
                  <Eye className="w-4 h-4" />
                  Original
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleFormatAndCompile}
                disabled={formattingNotes || aiProcessing || !formData.technician_notes?.trim()}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {formattingNotes ? 'Formatting...' : aiProcessing ? 'Compiling...' : 'Format & Compile'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={formData.technician_notes}
              onChange={(e) => handleChange('technician_notes', e.target.value)}
              placeholder="Keep adding notes as you work: observations, measurements, parts used, tests performed, etc. AI will consider ALL notes when compiling the report..."
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-500">
                💡 Add notes continuously. Click AI Compile anytime to update report sections based on ALL accumulated notes
              </p>
              {formData.original_technician_notes && (
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => setShowOriginalNotes(true)}
                  className="text-xs text-blue-600 h-auto p-0"
                >
                  View unmodified original
                </Button>
              )}
            </div>
            {aiSuggestions && aiSuggestions.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-2">✓ Report compiled! Additional info would help:</p>
                    <ul className="space-y-1 text-sm text-blue-800">
                      {aiSuggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-blue-700 mt-2">
                      Report sections updated below. Add more notes and re-compile to refine.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customer Complaint */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Customer Complaint</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={formData.complaint}
              onChange={(e) => handleChange('complaint', e.target.value)}
              placeholder="What issue is the customer experiencing? Include any relevant history..."
              rows={6}
            />
          </CardContent>
        </Card>
      </div>

      {/* CAT 7-Step Diagnostic */}
      <CatDiagnosticForm 
        diagnostic={formData.cat_diagnostic || {}}
        onChange={(val) => handleChange('cat_diagnostic', val)}
      />

      {/* Work Performed */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Work Performed</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea 
            value={formData.work_performed}
            onChange={(e) => handleChange('work_performed', e.target.value)}
            placeholder="Detail all repairs, adjustments, and work completed..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Service Items / Billing */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Billable Service Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceItemsEditor 
            items={formData.service_items || []}
            onChange={(items) => handleChange('service_items', items)}
          />
        </CardContent>
      </Card>

      {/* Destination Fee */}
      <DestinationFeeEditor 
        fee={formData.destination_fee || {}}
        onChange={(fee) => handleChange('destination_fee', fee)}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Photos */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoUpload 
              photos={formData.photos || []}
              onChange={(photos) => handleChange('photos', photos)}
            />
          </CardContent>
        </Card>

        {/* Signature & Notes */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Additional Notes</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any additional notes, follow-up needed, etc."
                rows={3}
              />
            </div>
            <div>
              <Label className="mb-2 block">Customer Signature</Label>
              <SignaturePad 
                initialValue={formData.customer_signature}
                onSave={(sig) => handleChange('customer_signature', sig)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <OriginalNotesViewer
        report={formData}
        open={showOriginalNotes}
        onOpenChange={setShowOriginalNotes}
      />
    </div>
  );
}