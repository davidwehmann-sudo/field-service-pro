import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Calendar, FileText, Plus, Search, Download } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from "sonner";
import { format } from 'date-fns';

export default function PaymentLog() {
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        if (!['service_admin', 'bookkeeper', 'software_engineer'].includes(user.user_type)) {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-payments'],
    queryFn: () => base44.entities.Invoice.list('-updated_date')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-payments'] });
      setShowForm(false);
      toast.success('Payment recorded successfully');
    }
  });

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const invoiceId = formData.get('invoice_id');
    
    const paymentData = {
      status: 'paid',
      payment_date: formData.get('payment_date'),
      payment_method: formData.get('payment_method'),
      payment_reference: formData.get('payment_reference'),
      notes: formData.get('notes')
    };

    recordPaymentMutation.mutate({ id: invoiceId, data: paymentData });
  };

  const downloadLog = () => {
    const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid');
    
    const csvContent = [
      ['Date', 'Invoice #', 'Customer', 'Amount', 'Method', 'Reference', 'Notes'].join(','),
      ...paidInvoices.map(inv => [
        inv.payment_date || '',
        inv.invoice_number || '',
        getCustomerName(inv.customer_id).replace(/,/g, ' '),
        inv.total_amount.toFixed(2),
        inv.payment_method || '',
        inv.payment_reference || '',
        (inv.notes || '').replace(/,/g, ' ').replace(/\n/g, ' ')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Payment log downloaded');
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      getCustomerName(inv.customer_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.payment_reference?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all' && inv.payment_date) {
      const paymentDate = new Date(inv.payment_date);
      const now = new Date();
      const daysAgo = (now - paymentDate) / (1000 * 60 * 60 * 24);
      
      if (dateFilter === 'week' && daysAgo > 7) matchesDate = false;
      if (dateFilter === 'month' && daysAgo > 30) matchesDate = false;
      if (dateFilter === 'quarter' && daysAgo > 90) matchesDate = false;
    }

    return matchesSearch && matchesDate && inv.status === 'paid';
  });

  const totalReceived = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  if (!currentUser) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cash & Check Payment Log</h1>
          <p className="text-slate-500 mt-1">Manual payment tracking for cash and check transactions</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">Total Payments Received</p>
              <p className="text-3xl font-bold">${totalReceived.toFixed(2)}</p>
              <p className="text-green-100 text-sm mt-1">{filteredInvoices.length} payments</p>
            </div>
            <DollarSign className="w-16 h-16 text-green-200 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by customer, invoice, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={downloadLog}>
          <Download className="w-4 h-4 mr-2" />
          Download CSV
        </Button>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">No payments recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          filteredInvoices.map((inv) => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {getCustomerName(inv.customer_id)}
                      </h3>
                      <span className="text-sm text-slate-500">
                        Invoice #{inv.invoice_number}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Payment Date</p>
                        <p className="font-medium text-slate-900">
                          {inv.payment_date ? format(new Date(inv.payment_date), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Method</p>
                        <p className="font-medium text-slate-900 capitalize">
                          {inv.payment_method || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Reference</p>
                        <p className="font-medium text-slate-900">
                          {inv.payment_reference || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Amount</p>
                        <p className="font-semibold text-green-600 text-lg">
                          ${inv.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {inv.notes && (
                      <p className="text-sm text-slate-600 mt-3 bg-slate-50 p-2 rounded">
                        {inv.notes}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div>
              <Label htmlFor="invoice_id">Invoice *</Label>
              <Select name="invoice_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices
                    .filter(inv => inv.status !== 'paid')
                    .map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        #{inv.invoice_number} - {getCustomerName(inv.customer_id)} - ${inv.total_amount.toFixed(2)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                name="payment_date"
                type="date"
                required
                defaultValue={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <Label htmlFor="payment_method">Payment Method *</Label>
              <Select name="payment_method" required defaultValue="cash">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="payment_reference">Reference # (Check #, etc.)</Label>
              <Input
                id="payment_reference"
                name="payment_reference"
                placeholder="Check #1234, etc."
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Additional payment details..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={recordPaymentMutation.isPending}
              >
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}