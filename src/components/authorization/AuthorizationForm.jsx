import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, CheckCircle, Sparkles, Loader2, Mail } from "lucide-react";
import CustomerSelect from '@/components/customers/CustomerSelect';
import SignaturePad from '@/components/ui/SignaturePad';
import NatureOfServiceInput from '@/components/authorization/NatureOfServiceInput';
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

export default function AuthorizationForm({ 
  authorization, 
  customers, 
  onSave, 
  onAuthorize,
  onBack,
  isSaving 
}) {
  const [jobs, setJobs] = React.useState([]);

  React.useEffect(() => {
    const loadJobs = async () => {
      const jobsList = await base44.entities.Job.list('-created_date');
      setJobs(jobsList);
    };
    loadJobs();
  }, []);

  const [formData, setFormData] = useState({
    job_id: '',
    customer_id: '',
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
    estimated_cost: '',
    cost_is_ai_estimate: false,
    authorization_signature: '',
    authorization_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'draft',
    ...authorization
  });

  const [isEstimatingCost, setIsEstimatingCost] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Clear AI flag if user manually edits the cost
      if (field === 'estimated_cost' && prev.cost_is_ai_estimate) {
        updated.cost_is_ai_estimate = false;
      }
      return updated;
    });
  };

  const handleEstimateCost = async () => {
    if (!formData.nature_of_service || !formData.service_type) {
      toast.error("Please fill in service type and description first");
      return;
    }

    setIsEstimatingCost(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a diesel field service technician estimating the cost of a repair job.

Service Type: ${serviceTypeLabels[formData.service_type]}
Equipment: ${formData.equipment_info || 'Not specified'}
Service Description: ${formData.nature_of_service}

Based on typical field service rates (diagnostic $125/hr, repair $115/hr, PM $95/hr, travel/destination fees, parts markup):
- Estimate realistic labor hours needed
- Consider typical parts costs if repairs are mentioned
- Include travel/destination considerations
- Factor in the service type

Provide ONLY a single estimated total dollar amount (no dollar sign, no decimals if whole number, just the number).
Example outputs: 850 or 1250.50

Be realistic and professional. This is an estimate that will be shown to a customer.`,
        response_json_schema: {
          type: "object",
          properties: {
            estimated_amount: { type: "number" }
          }
        }
      });

      if (response.estimated_amount) {
        setFormData(prev => ({
          ...prev,
          estimated_cost: response.estimated_amount.toString(),
          cost_is_ai_estimate: true
        }));
        toast.success("Cost estimate generated");
      }
    } catch (error) {
      toast.error("Failed to generate estimate");
    } finally {
      setIsEstimatingCost(false);
    }
  };

  const handleSave = async (status = 'draft') => {
    // Generate job number if new authorization and no job selected
    let jobId = formData.job_id;
    if (!authorization?.id && !jobId) {
      try {
        const jobNumberResult = await base44.functions.invoke('generateJobNumber', {});
        const jobNumber = jobNumberResult.data.job_number;
        
        const newJob = await base44.entities.Job.create({
          job_number: jobNumber,
          customer_id: formData.customer_id,
          job_type: 'service',
          status: status === 'authorized' ? 'in_progress' : 'open',
          description: formData.nature_of_service?.slice(0, 100) || 'Service authorization'
        });
        
        jobId = newJob.id;
        toast.success(`Job ${jobNumber} created`);
      } catch (error) {
        toast.error("Failed to create job number");
        return;
      }
    }
    
    const data = {
      ...formData,
      job_id: jobId,
      status,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
    };
    
    if (status === 'authorized') {
      await onAuthorize(data);
      // Show email prompt after successful authorization
      if (formData.billing_contact_email) {
        setShowEmailPrompt(true);
      }
    } else {
      onSave(data);
    }
  };

  const handleSendCopy = async () => {
    if (!formData.billing_contact_email) {
      toast.error("No email address provided");
      return;
    }

    setIsSendingEmail(true);
    try {
      const serviceTypeLabel = SERVICE_TYPES.find(t => t.value === formData.service_type)?.label || formData.service_type;
      const customer = customers.find(c => c.id === formData.customer_id);
      
      await base44.integrations.Core.SendEmail({
        to: formData.billing_contact_email,
        subject: `Pre-Repair Authorization - ${customer?.company_name || 'Service'}`,
        body: `
Dear ${formData.billing_contact_name},

Thank you for authorizing service work. Please keep this email for your records.

AUTHORIZATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customer: ${customer?.company_name || 'N/A'}
Service Type: ${serviceTypeLabel}
${formData.equipment_info ? `Equipment: ${formData.equipment_info}` : ''}
Authorization Date: ${format(new Date(formData.authorization_date), 'MMMM d, yyyy')}
${formData.estimated_cost ? `Estimated Cost: $${parseFloat(formData.estimated_cost).toFixed(2)}${formData.cost_is_ai_estimate ? ' (AI-generated estimate)' : ''}` : ''}

NATURE OF SERVICE:
${formData.nature_of_service}

BILLING CONTACT:
${formData.billing_contact_name}
${formData.billing_contact_company || ''}
${formData.billing_contact_phone || ''}
${formData.billing_address ? `${formData.billing_address}, ${formData.billing_city}, ${formData.billing_state} ${formData.billing_zip}` : ''}

${formData.on_site_contact_name ? `ON-SITE CONTACT:
${formData.on_site_contact_name}
${formData.on_site_contact_phone || ''}` : ''}

${formData.notes ? `NOTES:
${formData.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This authorization confirms your approval for the service work described above.

If you have any questions, please contact us.

Thank you for your business.
        `
      });

      toast.success(`Authorization sent to ${formData.billing_contact_email}`);
      setShowEmailPrompt(false);
    } catch (error) {
      toast.error("Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const isReadyToAuthorize = formData.customer_id && 
                             formData.billing_contact_name && 
                             formData.nature_of_service && 
                             formData.service_type &&
                             formData.authorization_signature;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">
            {authorization?.id ? 'Edit Authorization' : 'New Pre-Repair Authorization'}
          </h2>
          <p className="text-sm text-slate-500">Authorization for service work</p>
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
            onClick={() => handleSave('authorized')}
            disabled={isSaving || !isReadyToAuthorize}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Authorize
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customer & Service Type */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Customer & Service Details</CardTitle>
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
                  {jobs.filter(j => !formData.customer_id || j.customer_id === formData.customer_id).map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.job_number} - {customers.find(c => c.id === job.customer_id)?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Type *</Label>
              <Select 
                value={formData.service_type}
                onValueChange={(val) => handleChange('service_type', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Equipment/Unit Information</Label>
              <Input 
                value={formData.equipment_info}
                onChange={(e) => handleChange('equipment_info', e.target.value)}
                placeholder="E.g., 2018 Caterpillar D6T, SN: XYZ123"
              />
            </div>

            <div>
              <Label>Estimated Cost</Label>
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={(e) => handleChange('estimated_cost', e.target.value)}
                    placeholder="0.00"
                    className={`pl-7 ${formData.cost_is_ai_estimate ? 'border-blue-200 bg-blue-50/30' : ''}`}
                  />
                </div>
                {formData.cost_is_ai_estimate && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI-generated estimate
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEstimateCost}
                  disabled={isEstimatingCost || !formData.nature_of_service || !formData.service_type}
                  className="w-full text-xs"
                >
                  {isEstimatingCost ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Estimating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Estimate Cost
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label>Authorization Date</Label>
              <Input 
                type="date"
                value={formData.authorization_date}
                onChange={(e) => handleChange('authorization_date', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Contact Name (Responsible Party) *</Label>
              <Input 
                value={formData.billing_contact_name}
                onChange={(e) => handleChange('billing_contact_name', e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label>Company</Label>
              <Input 
                value={formData.billing_contact_company}
                onChange={(e) => handleChange('billing_contact_company', e.target.value)}
                placeholder="ABC Company LLC"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input 
                  type="tel"
                  value={formData.billing_contact_phone}
                  onChange={(e) => handleChange('billing_contact_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={formData.billing_contact_email}
                  onChange={(e) => handleChange('billing_contact_email', e.target.value)}
                  placeholder="billing@company.com"
                />
              </div>
            </div>

            <div>
              <Label>Billing Address</Label>
              <Input 
                value={formData.billing_address}
                onChange={(e) => handleChange('billing_address', e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <Input 
                  value={formData.billing_city}
                  onChange={(e) => handleChange('billing_city', e.target.value)}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input 
                  value={formData.billing_state}
                  onChange={(e) => handleChange('billing_state', e.target.value)}
                  maxLength={2}
                  placeholder="CA"
                />
              </div>
              <div>
                <Label>ZIP</Label>
                <Input 
                  value={formData.billing_zip}
                  onChange={(e) => handleChange('billing_zip', e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* On-Site Contact */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">On-Site Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Contact Name</Label>
            <Input 
              value={formData.on_site_contact_name}
              onChange={(e) => handleChange('on_site_contact_name', e.target.value)}
              placeholder="Site foreman or operator"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input 
              type="tel"
              value={formData.on_site_contact_phone}
              onChange={(e) => handleChange('on_site_contact_phone', e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        </CardContent>
      </Card>

      {/* Nature of Service */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Service Description</CardTitle>
        </CardHeader>
        <CardContent>
          <NatureOfServiceInput 
            value={formData.nature_of_service}
            onChange={(val) => handleChange('nature_of_service', val)}
          />
        </CardContent>
      </Card>

      {/* Authorization */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Authorization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Additional Notes</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any special instructions or conditions..."
              rows={3}
            />
          </div>
          <div>
            <Label className="mb-2 block">Authorized Signature *</Label>
            <SignaturePad 
              initialValue={formData.authorization_signature}
              onSave={(sig) => handleChange('authorization_signature', sig)}
            />
            <p className="text-xs text-slate-500 mt-2">
              By signing, you authorize the service described above and agree to pay for the work performed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Prompt Dialog */}
      {showEmailPrompt && (
        <Card className="fixed bottom-6 right-6 w-96 shadow-2xl border-2 border-green-200 bg-white z-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">Authorization Complete</h3>
                <p className="text-sm text-slate-600">
                  Send a copy to {formData.billing_contact_email}?
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEmailPrompt(false)}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                onClick={handleSendCopy}
                disabled={isSendingEmail}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}