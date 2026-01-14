import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Send } from "lucide-react";
import CustomerSelect from '@/components/customers/CustomerSelect';
import PhotoUpload from '@/components/service/PhotoUpload';
import SignaturePad from '@/components/ui/SignaturePad';
import { format } from 'date-fns';

const EQUIPMENT_TYPES = [
  'Semi Truck',
  'Trailer',
  'Generator',
  'Excavator',
  'Bulldozer',
  'Loader',
  'Forklift',
  'Crane',
  'Compressor',
  'Pump',
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
  const [formData, setFormData] = useState({
    customer_id: '',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    equipment_type: '',
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_hours: '',
    complaint: '',
    diagnosis: '',
    work_performed: '',
    labor_hours: '',
    labor_rate: '95',
    travel_hours: '',
    travel_rate: '75',
    photos: [],
    customer_signature: '',
    notes: '',
    status: 'draft',
    ...report
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (status = 'draft') => {
    const data = {
      ...formData,
      status,
      labor_hours: formData.labor_hours ? parseFloat(formData.labor_hours) : null,
      labor_rate: formData.labor_rate ? parseFloat(formData.labor_rate) : null,
      travel_hours: formData.travel_hours ? parseFloat(formData.travel_hours) : null,
      travel_rate: formData.travel_rate ? parseFloat(formData.travel_rate) : null,
      equipment_hours: formData.equipment_hours ? parseFloat(formData.equipment_hours) : null,
    };
    
    if (status === 'completed') {
      onComplete(data);
    } else {
      onSave(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {report?.id ? 'Edit Service Report' : 'New Service Report'}
          </h2>
          <p className="text-sm text-slate-500">Fill in the service details</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleSave('draft')}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => handleSave('completed')}
            disabled={isSaving || !formData.customer_id}
          >
            <Send className="w-4 h-4 mr-2" />
            Complete
          </Button>
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

        {/* Service Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Customer Complaint</Label>
              <Textarea 
                value={formData.complaint}
                onChange={(e) => handleChange('complaint', e.target.value)}
                placeholder="What issue is the customer experiencing?"
                rows={3}
              />
            </div>

            <div>
              <Label>Diagnosis</Label>
              <Textarea 
                value={formData.diagnosis}
                onChange={(e) => handleChange('diagnosis', e.target.value)}
                placeholder="What did you find?"
                rows={3}
              />
            </div>

            <div>
              <Label>Work Performed</Label>
              <Textarea 
                value={formData.work_performed}
                onChange={(e) => handleChange('work_performed', e.target.value)}
                placeholder="Detail all work performed"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Labor & Travel */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Labor & Travel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Labor Hours</Label>
                <Input 
                  type="number"
                  step="0.25"
                  value={formData.labor_hours}
                  onChange={(e) => handleChange('labor_hours', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Labor Rate ($/hr)</Label>
                <Input 
                  type="number"
                  value={formData.labor_rate}
                  onChange={(e) => handleChange('labor_rate', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Travel Hours</Label>
                <Input 
                  type="number"
                  step="0.25"
                  value={formData.travel_hours}
                  onChange={(e) => handleChange('travel_hours', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Travel Rate ($/hr)</Label>
                <Input 
                  type="number"
                  value={formData.travel_rate}
                  onChange={(e) => handleChange('travel_rate', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Photos & Signature */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">Photos</Label>
              <PhotoUpload 
                photos={formData.photos || []}
                onChange={(photos) => handleChange('photos', photos)}
              />
            </div>

            <div>
              <Label className="mb-3 block">Customer Signature</Label>
              <SignaturePad 
                initialValue={formData.customer_signature}
                onSave={(sig) => handleChange('customer_signature', sig)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}