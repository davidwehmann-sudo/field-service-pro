import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Eye, Building2, Sparkles, DollarSign, Check, Cloud, Activity, FileText, ClipboardList } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { debounce } from 'lodash';
import CustomerSelect from '@/components/customers/CustomerSelect';
import PhotoUpload from '@/components/service/PhotoUpload';
import SignaturePad from '@/components/ui/SignaturePad';
import CatDiagnosticForm from '@/components/service/CatDiagnosticForm';
import ServiceItemsEditor from '@/components/service/ServiceItemsEditor';
import DestinationFeeEditor from '@/components/service/DestinationFeeEditor';
import OfflineIndicator from '@/components/service/OfflineIndicator';
import OriginalNotesViewer from '@/components/service/OriginalNotesViewer';
import TimeTracker from '@/components/service/TimeTracker';
import FieldBenefitInfo from '@/components/service/FieldBenefitInfo';
import LocationCapture from '@/components/service/LocationCapture';
import ServiceReportReview from '@/components/service/ServiceReportReview';
import LitigationProtectionWarning from '@/components/service/LitigationProtectionWarning';
import ActivityTimeline from '@/components/service/ActivityTimeline';
import AddActivityEntry from '@/components/service/AddActivityEntry';
import FinalSummaryPanel from '@/components/service/FinalSummaryPanel';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const EQUIPMENT_TYPES = [
  'Auger','Baler','Bulldozer','Combine Harvester','Compressor','Crane',
  'Cultivator','Disc Harrow','Excavator','Forklift','Generator','Grain Cart',
  'Grain Dryer','Irrigation System','Loader','Plow','Planter','Pump',
  'Semi Truck','Sprayer','Tractor','Trailer','Other'
];

function numericOrNull(val) {
  if (val !== '' && val !== null && val !== undefined && !isNaN(parseFloat(val))) return parseFloat(val);
  return null;
}

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
  const [currentUser, setCurrentUser] = useState(null);
  const [showLitigationWarning, setShowLitigationWarning] = useState(false);
  const [missingLitigationFields, setMissingLitigationFields] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  const [activeTab, setActiveTab] = useState('details');
  // Live activity log state (kept separate from formData to support real-time updates)
  const [activityLog, setActivityLog] = useState(report?.activity_log || []);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && !report?.id) {
      try { return JSON.parse(saved); } catch (e) {}
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
      time_entries: [],
      cat_diagnostic: {},
      work_performed: '',
      service_items: [],
      destination_fee: {
        mileage: '', mileage_rate: '0.65', travel_hours: '',
        travel_rate: '75', location_condition: 'standard',
        condition_surcharge: 0, total: 0
      },
      photos: [], photos_initial: [], photos_failure: [],
      fluid_samples: [], fluid_analysis_results_url: '', photos_fluid_evidence: [],
      location_data: null, safety_precision_notes: '',
      customer_signature: '', technician_signature: '',
      notes: '', status: 'open', final_summary: '',
      activity_log: [],
      ...report
    };
  });

  // Load user
  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Real-time subscription for activity log updates from other technicians
  useEffect(() => {
    if (!report?.id) return;
    const unsubscribe = base44.entities.ServiceReport.subscribe((event) => {
      if (event.id === report.id && (event.type === 'update')) {
        const newLog = event.data?.activity_log || [];
        setActivityLog(newLog);
        // Also sync activity_log in formData so save includes latest
        setFormData(prev => ({ ...prev, activity_log: newLog }));
      }
    });
    return unsubscribe;
  }, [report?.id]);

  // Auto-save to localStorage (for new reports / offline)
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData, storageKey]);

  // Auto-save FORM fields to backend (debounced) — does NOT overwrite activity_log
  useEffect(() => {
    if (!report?.id) return;
    const autoSave = debounce(async () => {
      setAutoSaveStatus('saving');
      const fee = formData.destination_fee || {};
      try {
        // Only save non-log fields to avoid race conditions with activity entries
        await base44.entities.ServiceReport.update(report.id, {
          customer_id: formData.customer_id,
          job_id: formData.job_id,
          is_internal: formData.is_internal,
          service_date: formData.service_date,
          equipment_type: formData.equipment_type,
          equipment_make: formData.equipment_make,
          equipment_model: formData.equipment_model,
          equipment_serial: formData.equipment_serial,
          equipment_hours: numericOrNull(formData.equipment_hours),
          complaint: formData.complaint,
          technician_notes: formData.technician_notes,
          time_entries: formData.time_entries,
          cat_diagnostic: formData.cat_diagnostic,
          work_performed: formData.work_performed,
          service_items: formData.service_items,
          destination_fee: {
            ...fee,
            mileage: numericOrNull(fee.mileage),
            mileage_rate: numericOrNull(fee.mileage_rate),
            travel_hours: numericOrNull(fee.travel_hours),
            travel_rate: numericOrNull(fee.travel_rate),
            condition_surcharge: numericOrNull(fee.condition_surcharge),
            fuel_surcharge_percent: numericOrNull(fee.fuel_surcharge_percent),
            fuel_surcharge_amount: numericOrNull(fee.fuel_surcharge_amount),
            diesel_price_per_gallon: numericOrNull(fee.diesel_price_per_gallon),
            total: numericOrNull(fee.total),
          },
          photos: formData.photos,
          photos_initial: formData.photos_initial,
          photos_failure: formData.photos_failure,
          fluid_samples: formData.fluid_samples,
          fluid_analysis_results_url: formData.fluid_analysis_results_url,
          photos_fluid_evidence: formData.photos_fluid_evidence,
          location_data: formData.location_data,
          safety_precision_notes: formData.safety_precision_notes,
          customer_signature: formData.customer_signature,
          technician_signature: formData.technician_signature,
          notes: formData.notes,
          final_summary: formData.final_summary,
          original_technician_notes: formData.original_technician_notes,
        });
        setAutoSaveStatus('saved');
      } catch (error) {
        setAutoSaveStatus('error');
      }
    }, 2000);
    autoSave();
    return () => autoSave.cancel();
  }, [formData, report?.id]);

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Called when AddActivityEntry saves a new entry
  const handleEntryAdded = useCallback((entry) => {
    setActivityLog(prev => [...prev, entry]);
    setFormData(prev => ({ ...prev, activity_log: [...(prev.activity_log || []), entry] }));
  }, []);

  const handleFormatAndCompile = useCallback(async () => {
    if (!formData.technician_notes?.trim()) {
      toast.error('Please enter technician notes first');
      return;
    }
    setFormattingNotes(true);
    setAiProcessing(true);
    try {
      if (!formData.original_technician_notes) {
        setFormData(prev => ({ ...prev, original_technician_notes: formData.technician_notes }));
      }
      toast.info('Formatting notes...');
      const formatResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Format these technician notes professionally with categories. Use bullet points, **bold** for action verbs, *italics* for specs. Preserve all technical details:\n\n${formData.technician_notes}`
      });
      let formattedNotes = formData.technician_notes;
      if (formatResult) {
        formattedNotes = formatResult;
        setFormData(prev => ({ ...prev, technician_notes: formattedNotes }));
        toast.success('Notes formatted ✓');
      }
      setFormattingNotes(false);
      toast.info('Compiling report...');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a complete CAT 7-Step service report. Notes: ${formattedNotes}. Equipment: ${formData.equipment_type} ${formData.equipment_make} ${formData.equipment_model}. Complaint: ${formData.complaint}.`,
        response_json_schema: {
          type: "object",
          properties: {
            step1_verify_complaint: { type: "string" },
            step2_initial_inspection: { type: "string" },
            step3_list_causes: { type: "string" },
            step4_analyze_causes: { type: "string" },
            step5_repair: { type: "string" },
            step6_verify_repair: { type: "string" },
            work_performed: { type: "string" },
            billable_service_items: {
              type: "array",
              items: { type: "object", properties: { description: { type: "string" }, hours: { type: "number" } } }
            },
            suggested_additional_info: { type: "array", items: { type: "string" } }
          }
        }
      });
      setFormData(prev => ({
        ...prev,
        cat_diagnostic: {
          step1_verify_complaint: result.step1_verify_complaint,
          step2_initial_inspection: result.step2_initial_inspection,
          step3_list_causes: result.step3_list_causes,
          step4_analyze_causes: result.step4_analyze_causes,
          step5_repair: result.step5_repair,
          step6_verify_repair: result.step6_verify_repair
        },
        work_performed: result.work_performed,
        service_items: result.billable_service_items?.map(item => ({
          description: item.description, estimated_hours: item.hours,
          hours: '', rate: prev.service_items?.[0]?.rate || 0, total: 0
        })) || prev.service_items || []
      }));
      setAiSuggestions(result.suggested_additional_info?.length > 0 ? result.suggested_additional_info : null);
      toast.success('Report compiled ✓');
    } catch (error) {
      toast.error('Processing failed: ' + error.message);
    } finally {
      setFormattingNotes(false);
      setAiProcessing(false);
    }
  }, [formData]);

  const totals = useMemo(() => {
    const serviceTotal = (formData.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
    const destinationTotal = formData.destination_fee?.total || 0;
    return { serviceTotal, destinationTotal, grandTotal: serviceTotal + destinationTotal };
  }, [formData.service_items, formData.destination_fee]);

  const filteredJobs = useMemo(() =>
    jobs.filter(j => !formData.customer_id || j.customer_id === formData.customer_id),
    [jobs, formData.customer_id]
  );

  const checkMissingLitigationFields = useCallback(() => {
    const missing = [];
    if (!formData.photos_initial?.length) missing.push('photos_initial');
    if (!formData.photos_failure?.length) missing.push('photos_failure');
    const hasFluidData = formData.fluid_samples?.length > 0 || formData.fluid_analysis_results_url || formData.photos_fluid_evidence?.length > 0;
    if (hasFluidData) {
      if (!formData.fluid_samples?.length) missing.push('fluid_samples');
      if (!formData.fluid_analysis_results_url) missing.push('fluid_analysis_results_url');
      if (!formData.photos_fluid_evidence?.length) missing.push('photos_fluid_evidence');
    }
    if (!formData.location_data) missing.push('location_data');
    if (!formData.customer_signature) missing.push('customer_signature');
    return missing;
  }, [formData]);

  const handleReviewClick = useCallback(() => {
    const missing = checkMissingLitigationFields();
    if (missing.length > 0) {
      setMissingLitigationFields(missing);
      setShowLitigationWarning(true);
      return;
    }
    setShowReview(true);
  }, [checkMissingLitigationFields]);

  const buildSaveData = useCallback((status) => {
    const fee = formData.destination_fee || {};
    return {
      ...formData,
      activity_log: activityLog, // always use the latest live log
      status,
      equipment_hours: numericOrNull(formData.equipment_hours),
      destination_fee: {
        ...fee,
        mileage: numericOrNull(fee.mileage),
        mileage_rate: numericOrNull(fee.mileage_rate),
        travel_hours: numericOrNull(fee.travel_hours),
        travel_rate: numericOrNull(fee.travel_rate),
        condition_surcharge: numericOrNull(fee.condition_surcharge),
        fuel_surcharge_percent: numericOrNull(fee.fuel_surcharge_percent),
        fuel_surcharge_amount: numericOrNull(fee.fuel_surcharge_amount),
        diesel_price_per_gallon: numericOrNull(fee.diesel_price_per_gallon),
        total: numericOrNull(fee.total),
      },
    };
  }, [formData, activityLog]);

  const handleSave = useCallback(async (status = 'open') => {
    const data = buildSaveData(status);
    try {
      if (status === 'completed') {
        await onComplete(data);
      } else {
        await onSave(data);
      }
      localStorage.removeItem(storageKey);
      setShowReview(false);
    } catch (error) {
      console.error('Save failed, data preserved locally');
    }
  }, [buildSaveData, onSave, onComplete, storageKey]);

  const handleMarkComplete = useCallback(async () => {
    const missing = checkMissingLitigationFields();
    if (missing.length > 0) {
      setMissingLitigationFields(missing);
      setShowLitigationWarning(true);
    } else {
      setShowReview(true);
    }
  }, [checkMissingLitigationFields]);

  const handleProceedAnyway = useCallback(async () => {
    setShowLitigationWarning(false);
    setShowReview(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {report?.id ? 'Service Report' : 'New Service Report'}
          </h2>
          <p className="text-sm text-slate-500">
            {activityLog.length > 0 ? `${activityLog.length} activity entries` : 'Multi-tech activity log'}
          </p>
        </div>
        <OfflineIndicator />
        {report?.id && (
          <div className="flex items-center gap-2">
            {autoSaveStatus === 'saving' && (
              <Badge variant="outline" className="gap-1.5 text-slate-600">
                <Cloud className="w-3 h-3 animate-pulse" />Saving...
              </Badge>
            )}
            {autoSaveStatus === 'saved' && (
              <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50">
                <Check className="w-3 h-3" />Saved
              </Badge>
            )}
            {autoSaveStatus === 'error' && (
              <Badge variant="outline" className="gap-1.5 text-red-600 border-red-200 bg-red-50">
                Save error
              </Badge>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('open')} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />Save
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleReviewClick}
            disabled={isSaving || !formData.customer_id}
          >
            <Eye className="w-4 h-4 mr-2" />Review & Complete
          </Button>
        </div>
      </div>

      {/* Totals Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-slate-400">Labor</p>
            <p className="text-lg font-semibold">${totals.serviceTotal.toFixed(2)}</p>
          </div>
          <div className="text-slate-600">+</div>
          <div>
            <p className="text-xs text-slate-400">Travel</p>
            <p className="text-lg font-semibold">${totals.destinationTotal.toFixed(2)}</p>
          </div>
          <div className="text-slate-600">=</div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-2xl font-bold text-amber-400">${totals.grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 mb-2">
          <TabsTrigger value="details" className="gap-1.5">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Details</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Activity Log</span>
            {activityLog.length > 0 && (
              <Badge className="ml-1 bg-blue-600 text-white text-xs px-1.5 py-0 h-4">
                {activityLog.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="finalize" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Final Summary</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: DETAILS ── */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Customer & Equipment */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Customer & Equipment</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Customer *</Label>
                  <CustomerSelect customers={customers} value={formData.customer_id} onChange={(val) => handleChange('customer_id', val)} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    <div>
                      <Label className="text-sm font-medium">Internal Work</Label>
                      <p className="text-xs text-slate-500">For company equipment/non-billable</p>
                    </div>
                  </div>
                  <Switch checked={formData.is_internal} onCheckedChange={(val) => handleChange('is_internal', val)} />
                </div>
                <div>
                  <Label>Link to Job (Optional)</Label>
                  <Select value={formData.job_id || 'none'} onValueChange={(val) => handleChange('job_id', val === 'none' ? '' : val)}>
                    <SelectTrigger><SelectValue placeholder="Create new job or link existing" /></SelectTrigger>
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
                  <Input type="date" value={formData.service_date} onChange={(e) => handleChange('service_date', e.target.value)} />
                </div>
                <div>
                  <Label>Equipment Type</Label>
                  <Select value={formData.equipment_type} onValueChange={(val) => handleChange('equipment_type', val)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_TYPES.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Make</Label><Input value={formData.equipment_make} onChange={(e) => handleChange('equipment_make', e.target.value)} placeholder="Caterpillar" /></div>
                  <div><Label>Model</Label><Input value={formData.equipment_model} onChange={(e) => handleChange('equipment_model', e.target.value)} placeholder="D6T" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Serial Number</Label><Input value={formData.equipment_serial} onChange={(e) => handleChange('equipment_serial', e.target.value)} /></div>
                  <div><Label>Hour Meter</Label><Input type="number" value={formData.equipment_hours} onChange={(e) => handleChange('equipment_hours', e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Notes + AI Compile */}
            <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  Technician Notes
                  <Badge variant="outline" className="text-xs font-normal">Draft workspace</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  {formData.original_technician_notes && (
                    <Button size="sm" variant="ghost" onClick={() => setShowOriginalNotes(true)} className="gap-2 text-blue-600">
                      <Eye className="w-4 h-4" />Original
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleFormatAndCompile}
                    disabled={formattingNotes || aiProcessing || !formData.technician_notes?.trim()}
                    className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    {formattingNotes ? 'Formatting...' : aiProcessing ? 'Compiling...' : 'Format & Compile'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.technician_notes}
                  onChange={(e) => handleChange('technician_notes', e.target.value)}
                  placeholder="Raw notes workspace — use Activity Log tab to post updates that other techs can see in real-time..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-2">
                  💡 This is a draft workspace. Post to Activity Log for multi-tech collaboration.
                </p>
                {aiSuggestions?.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 mb-2">✓ Report compiled! Additional info would help:</p>
                        <ul className="space-y-1 text-sm text-blue-800">
                          {aiSuggestions.map((s, i) => <li key={i} className="flex gap-2"><span className="text-blue-600">•</span>{s}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Customer Complaint */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Customer Complaint</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={formData.complaint} onChange={(e) => handleChange('complaint', e.target.value)}
                placeholder="What issue is the customer experiencing?" rows={4} />
            </CardContent>
          </Card>

          {/* Time Tracker */}
          <TimeTracker entries={formData.time_entries || []} onChange={(entries) => handleChange('time_entries', entries)} currentUser={currentUser} />

          {/* Location */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <FieldBenefitInfo field="location_data">
                <CardTitle className="text-lg">📍 Service Location Verification</CardTitle>
              </FieldBenefitInfo>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">Automatically proves you were on-site at a specific time</p>
              <LocationCapture value={formData.location_data} onChange={(data) => handleChange('location_data', data)} />
            </CardContent>
          </Card>

          {/* CAT Diagnostic */}
          <CatDiagnosticForm
            diagnostic={formData.cat_diagnostic || {}}
            onChange={(val) => handleChange('cat_diagnostic', val)}
            photosInitial={formData.photos_initial || []}
            onPhotosInitialChange={(photos) => handleChange('photos_initial', photos)}
            photos={formData.photos || []}
            onPhotosChange={(photos) => handleChange('photos', photos)}
            photosFailure={formData.photos_failure || []}
            onPhotosFailureChange={(photos) => handleChange('photos_failure', photos)}
            safetyPrecisionNotes={formData.safety_precision_notes || ''}
            onSafetyPrecisionNotesChange={(notes) => handleChange('safety_precision_notes', notes)}
            fluidSamples={formData.fluid_samples || []}
            fluidAnalysisUrl={formData.fluid_analysis_results_url || ''}
            fluidPhotos={formData.photos_fluid_evidence || []}
            onFluidDataChange={(data) => {
              handleChange('fluid_samples', data.samples);
              handleChange('fluid_analysis_results_url', data.analysisUrl);
              handleChange('photos_fluid_evidence', data.photos);
            }}
          />

          {/* Service Items */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />Billable Service Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceItemsEditor items={formData.service_items || []} onChange={(items) => handleChange('service_items', items)} />
            </CardContent>
          </Card>

          {/* Destination Fee */}
          <DestinationFeeEditor fee={formData.destination_fee || {}} onChange={(fee) => handleChange('destination_fee', fee)} />

          {/* Signatures */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Signatures</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <FieldBenefitInfo field="customer_signature">
                    <Label className="mb-2 block font-semibold">Customer Signature *</Label>
                  </FieldBenefitInfo>
                  <SignaturePad initialValue={formData.customer_signature} onSave={(sig) => handleChange('customer_signature', sig)} />
                </div>
                <div>
                  <Label className="mb-2 block">Technician Signature</Label>
                  <SignaturePad initialValue={formData.technician_signature} onSave={(sig) => handleChange('technician_signature', sig)} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Additional Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Additional notes, follow-up needed, recommendations..." rows={10} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: ACTIVITY LOG ── */}
        <TabsContent value="activity" className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Multi-tech Activity Log</strong> — Each entry is saved independently. Multiple technicians can contribute simultaneously without overwriting each other. Updates appear in real-time.
          </div>

          {/* Add Entry Panel */}
          {report?.id ? (
            <AddActivityEntry
              reportId={report.id}
              currentUser={currentUser}
              onEntryAdded={handleEntryAdded}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              💾 Save the report first to start adding activity log entries.
            </div>
          )}

          {/* Timeline */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Activity Timeline
                <Badge variant="outline" className="text-xs">{activityLog.length} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline
                entries={activityLog}
                currentUserName={currentUser?.full_name || currentUser?.email}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: FINAL SUMMARY ── */}
        <TabsContent value="finalize" className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <strong>Lead Technician Final Summary</strong> — Review the activity log above, then write a clean summary for the invoice. Use Auto-generate to draft from the log entries.
          </div>

          <FinalSummaryPanel
            reportId={report?.id}
            value={formData.final_summary}
            activityLog={activityLog}
            onChange={(val) => handleChange('final_summary', val)}
            onMarkComplete={handleMarkComplete}
            isSaving={isSaving}
          />

          {/* Show activity log for reference */}
          {activityLog.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-600">Activity Log Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline
                  entries={activityLog}
                  currentUserName={currentUser?.full_name || currentUser?.email}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ServiceReportReview
        report={formData}
        customer={customers.find(c => c.id === formData.customer_id)}
        open={showReview}
        onOpenChange={setShowReview}
        onComplete={() => handleSave('completed')}
        isSaving={isSaving}
      />
      <OriginalNotesViewer report={formData} open={showOriginalNotes} onOpenChange={setShowOriginalNotes} />
      <LitigationProtectionWarning
        open={showLitigationWarning}
        onOpenChange={setShowLitigationWarning}
        missingFields={missingLitigationFields}
        onProceed={handleProceedAnyway}
        onGoBack={() => setShowLitigationWarning(false)}
      />
    </div>
  );
}