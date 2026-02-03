import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Wrench, AlertCircle } from "lucide-react";
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

export default function RequestAuthorization() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const [formData, setFormData] = useState({
    company_name: '',
    billing_contact_name: '',
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
    parts_payment_required: false,
    parts_payment_note: '',
    authorization_signature: '',
    notes: '',
  });

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Pre-fill email if user is logged in
        if (user?.email && !formData.billing_contact_email) {
          setFormData(prev => ({ ...prev, billing_contact_email: user.email }));
        }
      } catch (error) {
        // Not logged in - redirect to login
        await base44.auth.redirectToLogin(window.location.href);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const createAuthorizationMutation = useMutation({
    mutationFn: async (data) => {
      // Find or create customer
      let customerId;
      const existingCustomer = customers.find(c => 
        c.company_name?.toLowerCase() === data.company_name.trim().toLowerCase()
      );

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await base44.entities.Customer.create({
          company_name: data.company_name,
          contact_name: data.billing_contact_name,
          phone: data.billing_contact_phone,
          email: data.billing_contact_email,
          address: data.billing_address,
          city: data.billing_city,
          state: data.billing_state,
          zip: data.billing_zip,
        });
        customerId = newCustomer.id;
      }

      // Generate job number
      const jobNumberResult = await base44.functions.invoke('generateJobNumber', {});
      const jobNumber = jobNumberResult.data.job_number;

      // Create job
      const newJob = await base44.entities.Job.create({
        job_number: jobNumber,
        customer_id: customerId,
        job_type: 'service',
        status: 'open',
        description: data.nature_of_service?.slice(0, 100) || 'Customer authorization request'
      });

      // Create authorization
      return await base44.entities.PreRepairAuthorization.create({
        job_id: newJob.id,
        customer_id: customerId,
        billing_contact_name: data.billing_contact_name,
        billing_contact_company: data.company_name,
        billing_contact_phone: data.billing_contact_phone,
        billing_contact_email: data.billing_contact_email,
        billing_address: data.billing_address,
        billing_city: data.billing_city,
        billing_state: data.billing_state,
        billing_zip: data.billing_zip,
        on_site_contact_name: data.on_site_contact_name,
        on_site_contact_phone: data.on_site_contact_phone,
        nature_of_service: data.nature_of_service,
        service_type: data.service_type,
        equipment_info: data.equipment_info,
        estimated_cost: data.estimated_cost ? parseFloat(data.estimated_cost) : null,
        parts_payment_required: data.parts_payment_required,
        parts_payment_note: data.parts_payment_note,
        authorization_signature: data.authorization_signature,
        authorization_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'authorized',
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authorizations'] });
      setSubmitted(true);
      toast.success('Authorization request submitted successfully!');
    },
    onError: (error) => {
      toast.error('Failed to submit authorization request');
      console.error(error);
    },
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompanyNameBlur = () => {
    if (!formData.company_name.trim()) return;

    const matchedCustomer = customers.find(c => 
      c.company_name?.toLowerCase() === formData.company_name.trim().toLowerCase()
    );

    if (matchedCustomer) {
      setFormData(prev => ({
        ...prev,
        billing_contact_name: matchedCustomer.contact_name || prev.billing_contact_name,
        billing_contact_phone: matchedCustomer.phone || prev.billing_contact_phone,
        billing_contact_email: matchedCustomer.email || prev.billing_contact_email,
        billing_address: matchedCustomer.address || prev.billing_address,
        billing_city: matchedCustomer.city || prev.billing_city,
        billing_state: matchedCustomer.state || prev.billing_state,
        billing_zip: matchedCustomer.zip || prev.billing_zip,
      }));
      toast.success(`Welcome back, ${matchedCustomer.company_name}!`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.billing_contact_name || !formData.nature_of_service || 
        !formData.service_type || !formData.authorization_signature) {
      toast.error('Please fill in all required fields and sign the authorization');
      return;
    }

    createAuthorizationMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full border-0 shadow-xl">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Service Request Submitted!
            </h1>
            <p className="text-slate-600 text-lg mb-8">
              Thank you for requesting service. Our team will review your equipment needs and contact you shortly with an estimate.
            </p>
            <div className="bg-slate-50 rounded-xl p-6 text-left space-y-2">
              <p className="text-sm text-slate-600">
                <strong>Company:</strong> {formData.company_name}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Contact:</strong> {formData.billing_contact_name}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Email:</strong> {formData.billing_contact_email}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Service Type:</strong> {SERVICE_TYPES.find(t => t.value === formData.service_type)?.label}
              </p>
            </div>
            <p className="text-sm text-slate-500 mt-8">
              Your request has been received. We'll contact you within 24 hours to discuss the service and provide an authorization estimate.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Request Equipment Service
          </h1>
          <p className="text-lg text-slate-600">
            Complete this authorization form to request service on your equipment. We provide an AI-powered pre-repair estimate to offer some idea of what our services may cost. This is a data-driven estimate, and can be incorrect for uncommon situations.
          </p>
          {currentUser && (
            <p className="text-sm text-slate-500 mt-2">
              Logged in as {currentUser.email}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company & Contact Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-xl">Your Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Company Name *</Label>
                <Input 
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  onBlur={handleCompanyNameBlur}
                  placeholder="Your Company LLC"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter your company name - we'll autofill your details if you're a returning customer
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Contact Name *</Label>
                  <Input 
                    value={formData.billing_contact_name}
                    onChange={(e) => handleChange('billing_contact_name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input 
                    type="email"
                    value={formData.billing_contact_email}
                    onChange={(e) => handleChange('billing_contact_email', e.target.value)}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>

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
                <Label>Address</Label>
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

          {/* Service Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-xl">Equipment & Service Needed</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Service Type *</Label>
                <Select 
                  value={formData.service_type}
                  onValueChange={(val) => handleChange('service_type', val)}
                  required
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
                <Label>Describe the Problem *</Label>
                <NatureOfServiceInput 
                  value={formData.nature_of_service}
                  onChange={(val) => handleChange('nature_of_service', val)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tell us what's wrong with your equipment or what service is needed
                </p>
              </div>

              <div>
                <Label>Estimated Cost (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={(e) => handleChange('estimated_cost', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* On-Site Contact */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-xl">On-Site Contact (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
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
              </div>
            </CardContent>
          </Card>

          {/* Parts Payment */}
          <Card className="border-0 shadow-lg border-l-4 border-l-amber-500">
            <CardHeader className="bg-amber-50">
              <CardTitle className="text-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Parts Payment Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
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
                    placeholder="Specify payment terms or estimated parts cost..."
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-xl">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Textarea 
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any special instructions or conditions..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Authorization Signature */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-xl">Authorization Signature *</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <SignaturePad 
                initialValue={formData.authorization_signature}
                onSave={(sig) => handleChange('authorization_signature', sig)}
              />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>By signing above, you authorize us to:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                  <li>Inspect and diagnose your equipment</li>
                  <li>Perform the necessary repairs described above</li>
                  <li>Order and install required parts</li>
                  <li>You agree to pay for services rendered per the estimate provided</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <Button 
                type="submit"
                disabled={createAuthorizationMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                {createAuthorizationMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Submit Service Request
                  </>
                )}
              </Button>
              <p className="text-sm text-slate-600 text-center mt-4">
                We'll review your request and contact you within 24 hours with an estimate
              </p>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}