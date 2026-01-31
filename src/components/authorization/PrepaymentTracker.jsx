import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, DollarSign, Trash2, CreditCard } from "lucide-react";
import { format } from 'date-fns';
import { toast } from "sonner";

const PAYMENT_TYPE_LABELS = {
  prepayment_parts: "Parts Prepayment",
  prepayment_labor: "Labor Prepayment",
  prepayment_general: "General Prepayment"
};

const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  transfer: "Transfer",
  other: "Other"
};

export default function PrepaymentTracker({ authorizationId, customerId, jobId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payment_type: 'prepayment_parts',
    payment_method: 'cash',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    reference_number: '',
    notes: ''
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', authorizationId],
    queryFn: () => base44.entities.Payment.filter({ authorization_id: authorizationId }),
    enabled: !!authorizationId
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Payment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowForm(false);
      setFormData({
        amount: '',
        payment_type: 'prepayment_parts',
        payment_method: 'cash',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        reference_number: '',
        notes: ''
      });
      toast.success("Payment recorded");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success("Payment deleted");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    createMutation.mutate({
      authorization_id: authorizationId,
      customer_id: customerId,
      job_id: jobId,
      amount: parseFloat(formData.amount),
      payment_type: formData.payment_type,
      payment_method: formData.payment_method,
      payment_date: formData.payment_date,
      reference_number: formData.reference_number || null,
      notes: formData.notes || null
    });
  };

  const totalPrepaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Prepayments Received
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Payment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleSubmit} className="p-4 bg-slate-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Type *</Label>
                <Select
                  value={formData.payment_type}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, payment_type: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepayment_parts">Parts Prepayment</SelectItem>
                    <SelectItem value="prepayment_labor">Labor Prepayment</SelectItem>
                    <SelectItem value="prepayment_general">General Prepayment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method *</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, payment_method: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Reference # / Check #</Label>
              <Input
                value={formData.reference_number}
                onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                placeholder="Check number or transaction ID"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Payment details..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                Record Payment
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {payments.length > 0 ? (
          <>
            <div className="space-y-2">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-900">
                        ${payment.amount.toFixed(2)}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        {PAYMENT_TYPE_LABELS[payment.payment_type]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(new Date(payment.payment_date), 'MMM d, yyyy')} • {PAYMENT_METHOD_LABELS[payment.payment_method]}
                      {payment.reference_number && ` • Ref: ${payment.reference_number}`}
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-slate-600 mt-1">{payment.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(payment.id)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">Total Prepaid:</span>
                <span className="text-xl font-bold text-green-600">${totalPrepaid.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            No prepayments recorded yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}