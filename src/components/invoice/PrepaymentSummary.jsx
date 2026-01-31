import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, CreditCard } from "lucide-react";
import { format } from 'date-fns';

const PAYMENT_TYPE_LABELS = {
  prepayment_parts: "Parts",
  prepayment_labor: "Labor",
  prepayment_general: "General"
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  transfer: "Transfer",
  other: "Other"
};

export default function PrepaymentSummary({ jobId, invoiceId }) {
  const { data: payments = [] } = useQuery({
    queryKey: ['payments', jobId],
    queryFn: () => base44.entities.Payment.filter({ job_id: jobId }),
    enabled: !!jobId
  });

  // Filter for prepayments only (exclude final payments linked to this invoice)
  const prepayments = payments.filter(p => 
    p.payment_type !== 'final_payment' && 
    p.payment_type !== 'partial_payment' &&
    p.invoice_id !== invoiceId
  );

  if (prepayments.length === 0) return null;

  const totalPrepaid = prepayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <Card className="border-l-4 border-l-green-500 bg-green-50/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-semibold text-slate-900">Prepayments Received</h3>
              <p className="text-xs text-slate-500">These will be deducted from final invoice</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">
              ${totalPrepaid.toFixed(2)}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          {prepayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3 h-3 text-slate-400" />
                <span className="text-slate-600">
                  {PAYMENT_TYPE_LABELS[payment.payment_type]} • {format(new Date(payment.payment_date), 'MMM d')}
                </span>
              </div>
              <span className="font-semibold text-slate-900">
                ${payment.amount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}