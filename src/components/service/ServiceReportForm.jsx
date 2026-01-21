import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Send, DollarSign } from "lucide-react";
import CustomerSelect from '@/components/customers/CustomerSelect';
import PhotoUpload from '@/components/service/PhotoUpload';
import SignaturePad from '@/components/ui/SignaturePad';
import CatDiagnosticForm from '@/components/service/CatDiagnosticForm';
import ServiceItemsEditor from '@/components/service/ServiceItemsEditor';
import DestinationFeeEditor from '@/components/service/DestinationFeeEditor';
import OfflineIndicator from '@/components/service/OfflineIndicator';
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
  const storageKey = `service_report_draft_${report?.id || 'new'}`;

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
      customer_id: '',
      service_date: format(new Date(), 'yyyy-MM-dd'),
      equipment_type: '',
      equipment_make: '',
      equipment_model: '',
      equipment_serial: '',
      equipment_hours: '',
      complaint: '',
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
      status: 'draft',
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateTotals = () => {
    const serviceTotal = (formData.service_items || []).reduce(
      (sum, item) => sum + (item.total || 0), 0
    );
    const destinationTotal = formData.destination_fee?.total || 0;
    return { serviceTotal, destinationTotal, grandTotal: serviceTotal + destinationTotal };
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
      // Clear localStorage after successful save
      localStorage.removeItem(storageKey);
    } catch (error) {
      // Keep in localStorage if save fails
      console.error('Save failed, data preserved locally');
    }
  };

  const totals = calculateTotals();

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
    </div>
  );
}