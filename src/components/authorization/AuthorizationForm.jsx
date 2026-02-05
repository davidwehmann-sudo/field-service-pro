import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, CheckCircle, Sparkles, Loader2, Mail, AlertCircle } from "lucide-react";

import SignaturePad from '@/components/ui/SignaturePad';
import NatureOfServiceInput from '@/components/authorization/NatureOfServiceInput';
import PrepaymentTracker from '@/components/authorization/PrepaymentTracker';
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
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

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
    parts_payment_required: false,
    parts_payment_note: '',
    customer_initials: '',
    authorization_signature: '',
    authorization_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    status: 'draft',
    ...authorization
  });

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [customerSearchName, setCustomerSearchName] = useState('');

  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCustomerNameBlur = useCallback(() => {
    if (!customerSearchName.trim()) return;

    // Search for matching customer by company name (case-insensitive)
    const matchedCustomer = customers.find(c => 
      c.company_name?.toLowerCase() === customerSearchName.trim().toLowerCase()
    );

    if (matchedCustomer) {
      // Autofill all customer data
      setFormData(prev => ({
        ...prev,
        customer_id: matchedCustomer.id,
        billing_contact_company: matchedCustomer.company_name || '',
        billing_contact_name: matchedCustomer.contact_name || prev.billing_contact_name,
        billing_contact_phone: matchedCustomer.phone || prev.billing_contact_phone,
        billing_contact_email: matchedCustomer.email || prev.billing_contact_email,
        billing_address: matchedCustomer.address || prev.billing_address,
        billing_city: matchedCustomer.city || prev.billing_city,
        billing_state: matchedCustomer.state || prev.billing_state,
        billing_zip: matchedCustomer.zip || prev.billing_zip
      }));
      toast.success(`Customer "${matchedCustomer.company_name}" found and loaded`);
    } else {
      // Clear customer_id if no match - treat as new customer
      setFormData(prev => ({
        ...prev,
        customer_id: '',
        billing_contact_company: customerSearchName.trim()
      }));
    }
  }, [customerSearchName, customers]);



  const handleSave = async (status = 'draft') => {
    // Create new customer if no customer_id exists
    let customerId = formData.customer_id;
    if (!customerId && formData.billing_contact_company) {
      try {
        const newCustomer = await base44.entities.Customer.create({
          company_name: formData.billing_contact_company,
          contact_name: formData.billing_contact_name,
          phone: formData.billing_contact_phone,
          email: formData.billing_contact_email,
          address: formData.billing_address,
          city: formData.billing_city,
          state: formData.billing_state,
          zip: formData.billing_zip
        });
        customerId = newCustomer.id;
        toast.success(`New customer "${formData.billing_contact_company}" created`);
      } catch (error) {
        toast.error("Failed to create customer");
        return;
      }
    }

    // Generate job number if new authorization and no job selected
    let jobId = formData.job_id;
    if (!authorization?.id && !jobId) {
      try {
        const jobNumberResult = await base44.functions.invoke('generateJobNumber', {});
        const jobNumber = jobNumberResult.data.job_number;
        
        const newJob = await base44.entities.Job.create({
          job_number: jobNumber,
          customer_id: customerId,
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
      customer_id: customerId,
      job_id: jobId,
      status,
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

  const handleSendCopy = useCallback(async () => {
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
  }, [formData, customers]);

  const isReadyToAuthorize = useMemo(() => (formData.customer_id || formData.billing_contact_company) && 
                             formData.billing_contact_name && 
                             formData.nature_of_service && 
                             formData.service_type &&
                             formData.customer_initials &&
                             formData.authorization_signature, [formData]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => !formData.customer_id || j.customer_id === formData.customer_id);
  }, [jobs, formData.customer_id]);

  // Set initial customer search name when editing
  useEffect(() => {
    if (authorization?.id && formData.customer_id && customers.length > 0) {
      const customer = customers.find(c => c.id === formData.customer_id);
      if (customer) {
        setCustomerSearchName(customer.company_name || '');
      }
    }
  }, [authorization, formData.customer_id, customers]);

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
              <Label>Customer Company Name *</Label>
              <Input 
                value={customerSearchName || formData.billing_contact_company}
                onChange={(e) => setCustomerSearchName(e.target.value)}
                onBlur={handleCustomerNameBlur}
                placeholder="Enter company name..."
              />
              <p className="text-xs text-slate-500 mt-1">
                Type existing customer name to autofill, or enter new customer
              </p>
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
              <Label className="mb-2 block">Billing Structure Preview</Label>
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div>
                  <p className="font-semibold text-blue-900 mb-2">Standard Field Service Rates:</p>
                  <ul className="text-blue-800 space-y-1 ml-4 list-disc">
                    <li><strong>Diagnostic:</strong> $125/hr</li>
                    <li><strong>Repair:</strong> $115/hr</li>
                    <li><strong>Preventive Maintenance:</strong> $95/hr</li>
                    <li><strong>Emergency Service:</strong> Premium rates apply</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-blue-900 mb-2">Additional Charges:</p>
                  <ul className="text-blue-800 space-y-1 ml-4 list-disc">
                    <li>Travel/destination fees based on location</li>
                    <li>Parts billed at cost + standard markup</li>
                    <li>Sales tax applied where applicable</li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-blue-300">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="customer_initials_check"
                      checked={!!formData.customer_initials}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          handleChange('customer_initials', '');
                        }
                      }}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <Label htmlFor="customer_initials_check" className="cursor-pointer text-blue-900 font-semibold">
                        I acknowledge the billing structure above *
                      </Label>
                      {formData.customer_initials === '' && (
                        <p className="text-xs text-blue-700 mt-1">Please initial below to confirm</p>
                      )}
                    </div>
                  </div>
                  {formData.customer_initials !== '' && (
                    <div className="mt-3">
                      <Label className="text-blue-900">Your Initials *</Label>
                      <Input
                        value={formData.customer_initials}
                        onChange={(e) => handleChange('customer_initials', e.target.value.toUpperCase())}
                        placeholder="AB"
                        maxLength={4}
                        className="max-w-[100px] font-semibold bg-white"
                      />
                    </div>
                  )}
                </div>
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

      {/* Parts Payment Requirements */}
      <Card className="border-0 shadow-sm border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Parts Payment Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="parts_payment_required"
              checked={formData.parts_payment_required}
              onChange={(e) => handleChange('parts_payment_required', e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
            />
            <Label htmlFor="parts_payment_required" className="cursor-pointer">
              Parts must be paid upfront before service continues
            </Label>
          </div>
          {formData.parts_payment_required && (
            <div>
              <Label>Payment Requirements Note</Label>
              <Textarea 
                value={formData.parts_payment_note}
                onChange={(e) => handleChange('parts_payment_note', e.target.value)}
                placeholder="Specify payment terms, estimated parts cost, or other payment details..."
                rows={3}
              />
              <p className="text-xs text-slate-500 mt-2">
                💡 Example: "Parts estimated at $850. Payment required before ordering. Service will continue once parts arrive and are paid for."
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prepayments (only show if editing existing authorization) */}
      {authorization?.id && (
        <PrepaymentTracker
          authorizationId={authorization.id}
          customerId={formData.customer_id}
          jobId={formData.job_id}
        />
      )}

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