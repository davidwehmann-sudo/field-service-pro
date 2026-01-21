import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Sparkles, Loader2 } from "lucide-react";
import SignaturePad from '@/components/ui/SignaturePad';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

const SERVICE_TYPES = [
  { value: 'check_and_advise', label: 'Check and Advise' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'repair', label: 'Repair' },
  { value: 'preventive_maintenance', label: 'Preventive Maintenance' },
  { value: 'emergency_service', label: 'Emergency Service' },
];

export default function CustomerAuthorizationForm({ customerId, onComplete }) {
  const [formData, setFormData] = useState({
    customer_id: customerId,
    billing_contact_name: '',
    billing_contact_company: '',
    billing_contact_phone: '',
    billing_contact_email: '',
    billing_address: '',
    billing_city: '',
    billing_state: '',
    billing_zip: '',
    on_site_contact_name: '',
    on_site_contact_phone: '',
    nature_of_service: '',
    service_type: '',
    equipment_info: '',
    authorization_signature: '',
    authorization_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'draft',
  });

  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAIAssist = async () => {
    if (!formData.service_type) {
      toast.error("Please select a service type first");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Help write a professional service description for a diesel equipment repair authorization.

Service Type: ${SERVICE_TYPES.find(t => t.value === formData.service_type)?.label}
Equipment: ${formData.equipment_info || 'Not specified'}
Current description: ${formData.nature_of_service || 'None'}

Expand and improve this into a clear, professional description of what needs to be serviced or repaired. Be specific but concise. Write from the customer's perspective describing what's wrong or what service is needed.`,
      });

      handleChange('nature_of_service', response);
      toast.success("Description enhanced by AI");
    } catch (error) {
      toast.error("Failed to generate description");
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.billing_contact_name || !formData.service_type || !formData.nature_of_service || !formData.authorization_signature) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      await base44.entities.PreRepairAuthorization.create({
        ...formData,
        status: 'authorized'
      });
      toast.success("Authorization submitted successfully!");
      onComplete();
    } catch (error) {
      toast.error("Failed to submit authorization");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Service Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Service Type *</Label>
            <Select value={formData.service_type} onValueChange={(val) => handleChange('service_type', val)}>
              <SelectTrigger>
                <SelectValue placeholder="What type of service do you need?" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Equipment Information</Label>
            <Input 
              value={formData.equipment_info}
              onChange={(e) => handleChange('equipment_info', e.target.value)}
              placeholder="E.g., 2018 Caterpillar D6T, Serial: XYZ123"
            />
          </div>

          <div>
            <Label>What needs to be serviced? *</Label>
            <Textarea 
              value={formData.nature_of_service}
              onChange={(e) => handleChange('nature_of_service', e.target.value)}
              placeholder="Describe the issue or service needed..."
              rows={5}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAIAssist}
              disabled={isGeneratingDescription || !formData.service_type}
              className="mt-2"
            >
              {isGeneratingDescription ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enhancing...</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1" /> AI Writing Assistant</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Billing Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Contact Name *</Label>
              <Input 
                value={formData.billing_contact_name}
                onChange={(e) => handleChange('billing_contact_name', e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input 
                value={formData.billing_contact_company}
                onChange={(e) => handleChange('billing_contact_company', e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input 
                type="tel"
                value={formData.billing_contact_phone}
                onChange={(e) => handleChange('billing_contact_phone', e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.billing_contact_email}
                onChange={(e) => handleChange('billing_contact_email', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Input 
              value={formData.billing_address}
              onChange={(e) => handleChange('billing_address', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>City</Label>
              <Input value={formData.billing_city} onChange={(e) => handleChange('billing_city', e.target.value)} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={formData.billing_state} onChange={(e) => handleChange('billing_state', e.target.value)} maxLength={2} />
            </div>
            <div>
              <Label>ZIP</Label>
              <Input value={formData.billing_zip} onChange={(e) => handleChange('billing_zip', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">On-Site Contact (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <Input 
              value={formData.on_site_contact_name}
              onChange={(e) => handleChange('on_site_contact_name', e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input 
              type="tel"
              value={formData.on_site_contact_phone}
              onChange={(e) => handleChange('on_site_contact_phone', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Authorization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Additional Notes</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any special instructions..."
              rows={2}
            />
          </div>
          <div>
            <Label className="mb-2 block">Your Signature *</Label>
            <SignaturePad 
              initialValue={formData.authorization_signature}
              onSave={(sig) => handleChange('authorization_signature', sig)}
            />
            <p className="text-xs text-slate-500 mt-2">
              By signing, you authorize the service and agree to pay for the work performed.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button 
        className="w-full bg-green-600 hover:bg-green-700 h-12"
        onClick={handleSubmit}
        disabled={isSaving}
      >
        {isSaving ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
        ) : (
          <><CheckCircle className="w-5 h-5 mr-2" /> Submit Authorization</>
        )}
      </Button>
    </div>
  );
}