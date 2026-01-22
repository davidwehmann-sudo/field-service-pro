import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SignaturePad from '@/components/ui/SignaturePad';
import { CheckCircle, AlertCircle, Loader2, Calendar, DollarSign, Wrench, Building2, Sparkles } from "lucide-react";
import { format } from 'date-fns';
import { toast } from "sonner";

const SERVICE_TYPE_LABELS = {
  check_and_advise: "Check & Advise",
  consultation: "Consultation",
  diagnostic: "Diagnostic",
  repair: "Repair",
  preventive_maintenance: "Preventive Maintenance",
  emergency_service: "Emergency Service"
};

export default function AuthorizeService() {
  const [loading, setLoading] = useState(true);
  const [authorization, setAuthorization] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAuthorization = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setError('Invalid authorization link');
        setLoading(false);
        return;
      }

      try {
        // Call backend function to validate token and get authorization
        const response = await base44.functions.invoke('validateAuthToken', { token });
        
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setAuthorization(response.data.authorization);
          setCustomer(response.data.customer);
        }
      } catch (err) {
        setError('Failed to load authorization. Link may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    loadAuthorization();
  }, []);

  const handleAuthorize = async () => {
    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }

    setSubmitting(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      await base44.functions.invoke('authorizeService', {
        token,
        signature,
        authorization_date: new Date().toISOString().split('T')[0]
      });

      setSuccess(true);
      toast.success('Authorization complete! Thank you.');
    } catch (err) {
      toast.error('Failed to submit authorization');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Authorization Unavailable</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Authorization Complete</h2>
            <p className="text-slate-600 mb-4">
              Thank you for authorizing the service work. We'll begin shortly and keep you updated.
            </p>
            <p className="text-sm text-slate-500">
              A confirmation copy has been sent to your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!authorization) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Pre-Repair Authorization</CardTitle>
                <p className="text-amber-100 text-sm mt-1">Please review and authorize the service work below</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Customer & Service Info */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              Service Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 text-xs">Customer</Label>
                <p className="font-semibold text-slate-900">{customer?.company_name}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Service Type</Label>
                <Badge variant="outline" className="mt-1">
                  {SERVICE_TYPE_LABELS[authorization.service_type] || authorization.service_type}
                </Badge>
              </div>
            </div>

            {authorization.equipment_info && (
              <div>
                <Label className="text-slate-500 text-xs">Equipment</Label>
                <p className="text-slate-900">{authorization.equipment_info}</p>
              </div>
            )}

            <div>
              <Label className="text-slate-500 text-xs mb-2 block">Nature of Service</Label>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-slate-700 whitespace-pre-wrap">{authorization.nature_of_service}</p>
              </div>
            </div>

            {authorization.estimated_cost && (
              <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <Label className="text-blue-900 text-xs">Estimated Cost</Label>
                  <p className="font-bold text-blue-900">
                    ${parseFloat(authorization.estimated_cost).toFixed(2)}
                  </p>
                </div>
                {authorization.cost_is_ai_estimate && (
                  <Badge variant="outline" className="text-xs bg-white">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Estimate
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Contact */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Billing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label className="text-slate-500 text-xs">Responsible Party</Label>
              <p className="font-semibold text-slate-900">{authorization.billing_contact_name}</p>
              {authorization.billing_contact_company && (
                <p className="text-slate-600 text-sm">{authorization.billing_contact_company}</p>
              )}
            </div>
            {authorization.billing_contact_phone && (
              <div>
                <Label className="text-slate-500 text-xs">Phone</Label>
                <p className="text-slate-700">{authorization.billing_contact_phone}</p>
              </div>
            )}
            {authorization.billing_address && (
              <div>
                <Label className="text-slate-500 text-xs">Address</Label>
                <p className="text-slate-700">
                  {authorization.billing_address}
                  {authorization.billing_city && `, ${authorization.billing_city}`}
                  {authorization.billing_state && `, ${authorization.billing_state}`}
                  {authorization.billing_zip && ` ${authorization.billing_zip}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Authorization Signature */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Your Authorization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                By signing below, you authorize the service work described above and agree to pay for the work performed and parts supplied.
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Signature *</Label>
              <SignaturePad 
                onSave={setSignature}
              />
            </div>

            <Button 
              onClick={handleAuthorize}
              disabled={submitting || !signature}
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Authorize Service Work
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500">
              A confirmation copy will be sent to {authorization.billing_contact_email}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}