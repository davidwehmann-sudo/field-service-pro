import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SecurityChecklist() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          body { background: white !important; }
        }
      `}</style>

      {/* Header - No Print */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Security & Operations Checklist</h1>
          <p className="text-slate-600 mt-1">Reference guide for managing your field service app</p>
        </div>
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="w-4 h-4 mr-2" />
          Print Checklist
        </Button>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-slate-300 pb-4">
        <h1 className="text-2xl font-bold">Field Service Management</h1>
        <h2 className="text-xl">Security & Operations Checklist</h2>
        <p className="text-sm text-slate-600 mt-2">Date: _____________</p>
      </div>

      {/* Section 1: Data Security */}
      <Card className="mb-6 print:shadow-none print:border-2">
        <CardHeader className="bg-red-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Data Security Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="All job records have auto-generated job numbers (J-YYYY-###)" />
            <CheckItem text="Authorizations are linked to Jobs via job_id foreign key" />
            <CheckItem text="Service Reports are linked to Jobs via job_id" />
            <CheckItem text="Parts Orders are linked to Jobs via job_id" />
            <CheckItem text="Invoices reference original job_id for traceability" />
            <CheckItem text="Job status automatically updates based on related records" />
            <CheckItem text="Service company isolation is enforced (multi-company data separation)" />
            <CheckItem text="Stripe webhooks validate signatures before processing" />
            <CheckItem text="Payment data never stored in local database" />
            <CheckItem text="Admin functions verify user.role === 'admin' before execution" />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Daily Operations */}
      <Card className="mb-6 print:shadow-none print:border-2 print-page-break">
        <CardHeader className="bg-blue-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Daily Operations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="Review pending authorizations in Authorizations page" />
            <CheckItem text="Check service reports for completion status" />
            <CheckItem text="Update parts inventory levels after field work" />
            <CheckItem text="Generate invoices for completed service reports" />
            <CheckItem text="Send customer portal links for new customers" />
            <CheckItem text="Respond to customer chat messages" />
            <CheckItem text="Verify payment status on sent invoices" />
            <CheckItem text="Check low-stock alerts in parts inventory" />
            <CheckItem text="Review and approve parts orders" />
            <CheckItem text="Sync completed work with Google Calendar" />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Customer Portal Management */}
      <Card className="mb-6 print:shadow-none print:border-2">
        <CardHeader className="bg-green-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Customer Portal Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="Generate unique portal link for each customer from Customers page" />
            <CheckItem text="Share portal links only via secure channels (email, SMS)" />
            <CheckItem text="Verify link expiration (90-day validity)" />
            <CheckItem text="Regenerate expired links when customers report access issues" />
            <CheckItem text="Monitor customer chat for support requests" />
            <CheckItem text="Review customer-submitted authorizations promptly" />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Payment Processing */}
      <Card className="mb-6 print:shadow-none print:border-2 print-page-break">
        <CardHeader className="bg-purple-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-purple-600" />
            Payment & Invoicing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="Stripe integration is in Live Mode (accepting real payments)" />
            <CheckItem text="Invoice payment links are generated securely" />
            <CheckItem text="Payment confirmations are tracked via webhooks" />
            <CheckItem text="Customers receive invoice links via secure channels only" />
            <CheckItem text="Mark invoices as 'paid' only after webhook confirmation" />
            <CheckItem text="Review failed payments and follow up with customers" />
            <CheckItem text="Generate financial reports monthly (Financial Exports page)" />
          </div>
        </CardContent>
      </Card>

      {/* Section 5: User Access & Roles */}
      <Card className="mb-6 print:shadow-none print:border-2">
        <CardHeader className="bg-amber-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            User Access Management
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="Review user roles: admin vs regular user permissions" />
            <CheckItem text="Service technicians have 'service_technician' user_type" />
            <CheckItem text="Parts specialists have 'parts_specialist' user_type" />
            <CheckItem text="Bookkeepers have 'bookkeeper' user_type" />
            <CheckItem text="Remove access for terminated employees immediately" />
            <CheckItem text="Audit admin actions quarterly" />
            <CheckItem text="Train new users on security best practices" />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Integration Security */}
      <Card className="mb-6 print:shadow-none print:border-2 print-page-break">
        <CardHeader className="bg-indigo-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Third-Party Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="Google Calendar sync is authorized and active" />
            <CheckItem text="Google Maps API key is secured (not exposed in frontend)" />
            <CheckItem text="Stripe API keys are stored as environment secrets" />
            <CheckItem text="Webhook endpoints validate incoming requests" />
            <CheckItem text="OAuth tokens are refreshed before expiration" />
            <CheckItem text="Review integration logs for suspicious activity" />
          </div>
        </CardContent>
      </Card>

      {/* Section 7: Incident Response */}
      <Card className="mb-6 print:shadow-none print:border-2">
        <CardHeader className="bg-red-50 print:bg-white">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Security Incident Response
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <CheckItem text="If customer reports unauthorized access: Immediately deactivate portal token" />
            <CheckItem text="If payment issue occurs: Check Stripe dashboard webhook logs" />
            <CheckItem text="If data breach suspected: Document incident and notify affected customers" />
            <CheckItem text="Review access logs for unauthorized admin actions" />
            <CheckItem text="Change API keys if compromise is suspected" />
            <CheckItem text="Keep emergency contact list for Base44 support" />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 p-6 bg-slate-50 rounded-lg print:bg-white print:border-2">
        <h3 className="font-bold text-lg mb-3">Quick Reference</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">Key Pages:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Dashboard - Overview & metrics</li>
              <li>Jobs - View & track all jobs</li>
              <li>Authorizations - Review & authorize work</li>
              <li>Service Reports - Complete & document work</li>
              <li>Invoices - Generate & track payments</li>
              <li>Customers - Manage all customer data</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Security Contacts:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Base44 Support: support@base44.com</li>
              <li>Stripe Support: https://support.stripe.com</li>
              <li>Emergency: Document all incidents</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 text-center text-sm text-slate-500 border-t pt-4">
        <p>This checklist should be reviewed regularly. Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function CheckItem({ text }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input 
        type="checkbox" 
        className="mt-1 w-4 h-4 print:w-5 print:h-5 rounded border-slate-300" 
      />
      <span className="text-sm text-slate-700 group-hover:text-slate-900 leading-relaxed">
        {text}
      </span>
    </label>
  );
}