import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Calendar,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2
} from "lucide-react";
import { format } from 'date-fns';

export default function PayInvoice() {
  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('invoice_id');
  const success = urlParams.get('success') === 'true';

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const invoices = await base44.entities.Invoice.list();
      return invoices.find(i => i.id === invoiceId);
    },
    enabled: !!invoiceId
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', invoice?.customer_id],
    queryFn: async () => {
      if (!invoice?.customer_id) return null;
      const customers = await base44.entities.Customer.list();
      return customers.find(c => c.id === invoice.customer_id);
    },
    enabled: !!invoice?.customer_id
  });

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // Create Stripe checkout session
      const response = await base44.functions.invoke('stripeCheckout', {
        invoice_id: invoice.id
      });

      if (response.data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.checkout_url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      alert('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">Invoice not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === 'paid' || paymentComplete || success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Complete!</h2>
            <p className="text-slate-500">Thank you for your payment</p>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Amount Paid</p>
              <p className="text-2xl font-bold text-slate-900">
                ${(invoice.total_amount || 0).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">DieselTech Invoice</h1>
          <p className="text-slate-500 mt-1">Secure Payment Portal</p>
        </div>

        <div className="space-y-6">
          {/* Invoice Details */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Invoice Details</span>
                <Badge className="bg-blue-100 text-blue-700">
                  {invoice.invoice_number}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer && (
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{customer.company_name}</p>
                    {customer.contact_name && (
                      <p className="text-sm text-slate-500">{customer.contact_name}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Invoice Date: {format(new Date(invoice.invoice_date), 'MMMM d, yyyy')}</span>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Labor</span>
                  <span className="font-medium">${(invoice.labor_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Travel</span>
                  <span className="font-medium">${(invoice.travel_total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Parts</span>
                  <span className="font-medium">${(invoice.parts_total || 0).toFixed(2)}</span>
                </div>
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Tax ({invoice.tax_rate}%)</span>
                    <span className="font-medium">${(invoice.tax_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total Amount</span>
                  <span className="text-green-600">${(invoice.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Secure Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePayment} className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    You'll be redirected to our secure payment processor to complete your transaction.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white h-12"
                  disabled={processing}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Redirecting to payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Pay ${(invoice.total_amount || 0).toFixed(2)} with Card
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-slate-500">
                  Secure payment powered by Stripe
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}