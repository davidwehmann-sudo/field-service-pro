import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Send, Camera, Sparkles } from "lucide-react";
import PhotoUpload from '@/components/service/PhotoUpload';
import SignaturePad from '@/components/ui/SignaturePad';
import OfflineIndicator from '@/components/service/OfflineIndicator';
import { format } from 'date-fns';

const EQUIPMENT_TYPES = [
  'Semi Truck', 'Trailer', 'Generator', 'Excavator', 'Bulldozer', 
  'Loader', 'Forklift', 'Crane', 'Compressor', 'Pump', 'Other'
];

export default function MobileServiceForm({ 
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

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved && !report?.id) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    
    return {
      customer_id: '',
      service_date: format(new Date(), 'yyyy-MM-dd'),
      equipment_type: '',
      equipment_make: '',
      equipment_model: '',
      equipment_hours: '',
      complaint: '',
      technician_notes: '',
      work_performed: '',
      photos: [],
      customer_signature: '',
      notes: '',
      status: 'draft',
      ...report
    };
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(formData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData, storageKey]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAIDerive = async () => {
    if (!formData.technician_notes?.trim()) {
      alert('Please enter technician notes first');
      return;
    }

    setAiProcessing(true);
    try {
      const { base44 } = await import('@/api/base44Client');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a field service technician documentation assistant. Analyze the provided information and either generate complete documentation or request specific additional information.

Current Information:
- Technician Notes: ${formData.technician_notes}
- Equipment: ${formData.equipment_type} ${formData.equipment_make} ${formData.equipment_model}
- Customer Complaint: ${formData.complaint}
- Photos: ${formData.photos?.length || 0}
- Equipment Hours: ${formData.equipment_hours || 'Not provided'}

If sufficient, provide a clear work performed description. If critical info is missing, set needs_more_info to true and list specific requests.`,
        response_json_schema: {
          type: "object",
          properties: {
            needs_more_info: { type: "boolean" },
            requested_info: { 
              type: "array",
              items: { type: "string" }
            },
            work_performed: { type: "string" }
          }
        }
      });

      if (result.needs_more_info) {
        setAiSuggestions(result.requested_info);
      } else {
        setFormData(prev => ({
          ...prev,
          work_performed: result.work_performed
        }));
        setAiSuggestions(null);
      }
    } catch (error) {
      alert('AI processing failed: ' + error.message);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleSave = async (status = 'draft') => {
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
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Save failed, data preserved locally');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-6">
      {/* Sticky Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-bold">Service Report</h2>
          <OfflineIndicator />
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="flex-1 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button 
            onClick={() => handleSave('completed')}
            disabled={isSaving || !formData.customer_id}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Complete
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Customer & Date */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Customer *</Label>
              <Select 
                value={formData.customer_id}
                onValueChange={(val) => handleChange('customer_id', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Service Date</Label>
              <Input 
                type="date"
                value={formData.service_date}
                onChange={(e) => handleChange('service_date', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Equipment */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Equipment Details</h3>
            
            <div>
              <Label className="text-xs">Type</Label>
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Make</Label>
                <Input 
                  value={formData.equipment_make}
                  onChange={(e) => handleChange('equipment_make', e.target.value)}
                  placeholder="Caterpillar"
                />
              </div>
              <div>
                <Label className="text-xs">Model</Label>
                <Input 
                  value={formData.equipment_model}
                  onChange={(e) => handleChange('equipment_model', e.target.value)}
                  placeholder="D6T"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Hour Meter</Label>
              <Input 
                type="number"
                value={formData.equipment_hours}
                onChange={(e) => handleChange('equipment_hours', e.target.value)}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Complaint */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Label className="text-xs mb-2 block">Customer Complaint</Label>
            <Textarea 
              value={formData.complaint}
              onChange={(e) => handleChange('complaint', e.target.value)}
              placeholder="What's the issue?"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Technician Notes */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Technician Notes</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAIDerive}
                disabled={aiProcessing || !formData.technician_notes?.trim()}
                className="h-7 text-xs gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {aiProcessing ? 'Processing...' : 'AI Derive'}
              </Button>
            </div>
            <Textarea 
              value={formData.technician_notes}
              onChange={(e) => handleChange('technician_notes', e.target.value)}
              placeholder="Quick notes: what you found, what you did..."
              rows={4}
            />
            <p className="text-xs text-slate-500 mt-1">
              💡 Type notes, then click AI Derive
            </p>
            {aiSuggestions && aiSuggestions.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-900 mb-1">AI needs more info:</p>
                    <ul className="space-y-1 text-xs text-amber-800">
                      {aiSuggestions.map((suggestion, idx) => (
                        <li key={idx}>• {suggestion}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 mt-1">
                      Add details above, then try again
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Performed */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Label className="text-xs mb-2 block">Work Performed</Label>
            <Textarea 
              value={formData.work_performed}
              onChange={(e) => handleChange('work_performed', e.target.value)}
              placeholder="What did you do?"
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Photos */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-slate-600" />
              <Label className="text-xs">Photos</Label>
            </div>
            <PhotoUpload 
              photos={formData.photos || []}
              onChange={(photos) => handleChange('photos', photos)}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Label className="text-xs mb-2 block">Additional Notes</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any other details..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Signature */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Label className="text-xs mb-2 block">Customer Signature</Label>
            <SignaturePad 
              initialValue={formData.customer_signature}
              onSave={(sig) => handleChange('customer_signature', sig)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}