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
            <CheckItem text="Authorization access tokens expire after 90 days" />
            <CheckItem text="Customer portal access is token-based (no password required)" />
            <CheckItem text="Stripe webhooks validate signatures before processing payments" />
            <CheckItem text="Payment data never stored in local database (PCI compliance)" />
            <CheckItem text="Admin functions verify user.role === 'admin' before execution" />
            <CheckItem text="Backend functions authenticate requests using base44.auth.me()" />
            <CheckItem text="Service role operations are restricted to authorized use cases" />
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
            <CheckItem text="Check service reports for completion and accuracy" />
            <CheckItem text="Update parts inventory levels after receiving stock" />
            <CheckItem text="Generate invoices for completed service reports" />
            <CheckItem text="Send customer portal links for new customers" />
            <CheckItem text="Verify payment status on sent invoices (check Stripe dashboard)" />
            <CheckItem text="Monitor parts with low stock or reorder alerts" />
            <CheckItem text="Review and update parts orders status (ordered → received → installed)" />
            <CheckItem text="Track vehicle expenses and attach receipts" />
            <CheckItem text="Reconcile payment logs with bank statements" />
            <CheckItem text="Sync service appointments with Google Calendar" />
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
            <CheckItem text="Generate unique portal link for each customer (Customers page → Generate Link)" />
            <CheckItem text="Share portal links only via secure channels (email/SMS, never public posts)" />
            <CheckItem text="Portal tokens expire after 90 days - regenerate if customer reports access issues" />
            <CheckItem text="Customers can view only their own service reports and invoices" />
            <CheckItem text="Customers can submit authorization requests via their portal" />
            <CheckItem text="Review customer-submitted authorizations and approve/edit as needed" />
            <CheckItem text="Provide payment links directly from Invoices page (secure per-invoice URLs)" />
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
            <CheckItem text="Invoice payment links generate unique Stripe checkout sessions" />
            <CheckItem text="Payment confirmations are tracked automatically via Stripe webhooks" />
            <CheckItem text="Invoices auto-update to 'paid' status when payment succeeds" />
            <CheckItem text="Payment method and reference are logged in payment_log entity" />
            <CheckItem text="Review failed/overdue invoices weekly and follow up with customers" />
            <CheckItem text="Manual payments (cash/check) are recorded with payment_reference" />
            <CheckItem text="Export financial data monthly from Data Management page" />
            <CheckItem text="Reconcile Stripe dashboard with app payment logs" />
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
            <CheckItem text="Google Calendar OAuth is authorized (check Code → Functions)" />
            <CheckItem text="Calendar sync creates events for service reports automatically" />
            <CheckItem text="Google Maps API key secured as GOOGLE_MAPS_API_KEY secret" />
            <CheckItem text="Stripe API keys stored as STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY" />
            <CheckItem text="Stripe webhook secret stored as STRIPE_WEBHOOK_SECRET" />
            <CheckItem text="Webhook endpoints validate signatures/tokens before processing" />
            <CheckItem text="Authorization tokens (AuthorizationAccessToken) expire after 90 days" />
            <CheckItem text="Review backend function logs for errors or suspicious calls" />
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
            <CheckItem text="If customer reports unauthorized access: Deactivate their portal token in AuthorizationAccessToken entity" />
            <CheckItem text="If payment fails: Check Stripe dashboard → Webhooks for delivery errors" />
            <CheckItem text="If invoice not updating to 'paid': Verify webhook endpoint is receiving events" />
            <CheckItem text="If data breach suspected: Document incident, assess scope, notify affected parties" />
            <CheckItem text="Review User entity for unauthorized admin role assignments" />
            <CheckItem text="Rotate API keys if compromise suspected (Stripe, Google Maps)" />
            <CheckItem text="Contact Base44 support for platform-level security issues" />
            <CheckItem text="Backup critical data regularly using Data Management export feature" />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 p-6 bg-slate-50 rounded-lg print:bg-white print:border-2">
        <h3 className="font-bold text-lg mb-3">Quick Reference</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold mb-2">Key Pages:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Dashboard - Overview & metrics</li>
              <li>Jobs - Unified job tracking with drag-and-drop</li>
              <li>Authorizations - Pre-repair approvals</li>
              <li>Service Reports - Field work documentation</li>
              <li>Invoices - Billing & payment tracking</li>
              <li>Parts Orders - Track parts lifecycle</li>
              <li>Parts Inventory - Stock management</li>
              <li>Our Vehicles - Fleet tracking</li>
              <li>Expenses - Vehicle costs & receipts</li>
              <li>Customers - Customer data & portal links</li>
              <li>Data Management - Exports & backups</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>Always verify user authentication before sensitive operations</li>
              <li>Use service company filtering for multi-tenant data</li>
              <li>Keep all API keys in environment secrets, never in code</li>
              <li>Test payment flows in Stripe test mode before going live</li>
              <li>Regular backups via Data Management export</li>
              <li>Base44 Support: support@base44.com</li>
              <li>Stripe Dashboard: https://dashboard.stripe.com</li>
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