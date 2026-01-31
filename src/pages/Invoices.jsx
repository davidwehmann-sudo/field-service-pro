import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Receipt,
  Pencil,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
  Check,
  FileText,
  Printer,
  Mail,
  Send,
  Link as LinkIcon,
  Copy
} from "lucide-react";
import { format, addDays } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import CustomerSelect from '@/components/customers/CustomerSelect';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';
import PrepaymentSummary from '@/components/invoice/PrepaymentSummary';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

export default function Invoices() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const fromReportId = urlParams.get('from_report');
  const shouldOpenNew = urlParams.get('new') === 'true';
  const autoGenerate = urlParams.get('auto_generate') === 'true';

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date')
  });

  const { data: partsOrders = [] } = useQuery({
    queryKey: ['partsOrders'],
    queryFn: () => base44.entities.PartsOrder.list()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
  });

  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const generateInvoiceNumber = useCallback(() => {
    const prefix = 'INV';
    const date = format(new Date(), 'yyyyMMdd');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${date}-${random}`;
  }, []);

  useEffect(() => {
    if (fromReportId && serviceReports.length > 0) {
      const report = serviceReports.find(r => r.id === fromReportId);
      if (report) {
        const reportParts = partsOrders.filter(p => p.service_report_id === fromReportId);
        
        // Calculate service items total (new hourly billing structure)
        const serviceItemsTotal = (report.service_items || []).reduce(
          (sum, item) => sum + (item.total || 0), 0
        );
        
        const destinationTotal = report.destination_fee?.total || 0;
        const partsTotal = reportParts.reduce((sum, p) => {
          const cost = (p.unit_cost || 0) * (p.quantity || 1);
          const markup = cost * ((p.markup_percent || 0) / 100);
          return sum + cost + markup;
        }, 0);

        const invoiceData = {
          customer_id: report.customer_id,
          service_report_id: report.id,
          invoice_date: format(new Date(), 'yyyy-MM-dd'),
          due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
          labor_total: serviceItemsTotal,
          travel_total: destinationTotal,
          parts_total: partsTotal,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: serviceItemsTotal + destinationTotal + partsTotal,
          status: 'draft'
        };

        if (autoGenerate) {
          // Auto-create the invoice
          createMutation.mutate({
            ...invoiceData,
            invoice_number: generateInvoiceNumber()
          });
        } else {
          setEditingInvoice(invoiceData);
          setShowForm(true);
        }
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (shouldOpenNew) {
      setShowForm(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fromReportId, serviceReports, partsOrders, shouldOpenNew, autoGenerate, generateInvoiceNumber]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingInvoice(null);
      toast.success('Invoice created');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create invoice');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingInvoice(null);
      setShowPayment(false);
      setPayingInvoice(null);
      toast.success('Invoice updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update invoice');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setInvoiceToDelete(null);
      toast.success('Invoice deleted');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete invoice');
    }
  });

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown Customer';
  }, [customers]);

  const filteredInvoices = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return invoices.filter(i => {
      const matchesSearch = !search || (
        getCustomerName(i.customer_id).toLowerCase().includes(lowerSearch) ||
        i.invoice_number?.toLowerCase().includes(lowerSearch)
      );
      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchesCustomer = customerFilter === 'all' || i.customer_id === customerFilter;
      
      const matchesDateRange = (!startDate || !endDate) || (
        i.invoice_date && 
        new Date(i.invoice_date) >= new Date(startDate) && 
        new Date(i.invoice_date) <= new Date(endDate)
      );
      
      return matchesSearch && matchesStatus && matchesCustomer && matchesDateRange;
    });
  }, [invoices, search, statusFilter, customerFilter, startDate, endDate, getCustomerName]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const laborTotal = parseFloat(formData.get('labor_total')) || 0;
    const travelTotal = parseFloat(formData.get('travel_total')) || 0;
    const partsTotal = parseFloat(formData.get('parts_total')) || 0;
    const discountPercent = parseFloat(formData.get('discount_percent')) || 0;
    const manualOverride = formData.get('manual_price_override') ? parseFloat(formData.get('manual_price_override')) : null;
    const taxRate = parseFloat(formData.get('tax_rate')) || 0;
    
    let totalAmount;
    let taxAmount;
    
    if (manualOverride !== null && manualOverride > 0) {
      // Manual override bypasses all calculations
      totalAmount = manualOverride;
      taxAmount = 0; // Tax included in override
    } else {
      // Normal calculation with optional discount
      const subtotal = laborTotal + travelTotal + partsTotal;
      const discountAmount = subtotal * (discountPercent / 100);
      const afterDiscount = subtotal - discountAmount;
      taxAmount = afterDiscount * (taxRate / 100);
      totalAmount = afterDiscount + taxAmount;
    }

    const data = {
      invoice_number: formData.get('invoice_number') || generateInvoiceNumber(),
      customer_id: formData.get('customer_id'),
      service_report_id: formData.get('service_report_id') || null,
      invoice_date: formData.get('invoice_date'),
      due_date: formData.get('due_date'),
      labor_total: laborTotal,
      travel_total: travelTotal,
      parts_total: partsTotal,
      discount_percent: discountPercent,
      manual_price_override: manualOverride,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: formData.get('status') || 'draft',
      notes: formData.get('notes')
    };
    
    if (editingInvoice?.id) {
      updateMutation.mutate({ id: editingInvoice.id, data });
    } else {
      createMutation.mutate(data);
    }
  }, [editingInvoice, generateInvoiceNumber, createMutation, updateMutation]);

  const handlePayment = useCallback((e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    updateMutation.mutate({
      id: payingInvoice.id,
      data: {
        status: 'paid',
        payment_method: formData.get('payment_method'),
        payment_date: formData.get('payment_date'),
        payment_reference: formData.get('payment_reference')
      }
    });
  }, [payingInvoice, updateMutation]);

  const handleGeneratePaymentLink = useCallback(async (invoice) => {
    const paymentUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/PayInvoice')}?invoice_id=${invoice.id}`;
    
    try {
      await navigator.clipboard.writeText(paymentUrl);
      toast.success('Payment link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy link');
      console.log('Payment URL:', paymentUrl);
    }
  }, []);

  const handlePrintInvoice = useCallback(async (invoiceId) => {
    try {
      const response = await base44.functions.invoke('generateInvoicePDF', { invoice_id: invoiceId });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Invoice PDF downloaded');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  }, []);

  const handleSendEmail = useCallback(async (invoice) => {
    const customer = customers.find(c => c.id === invoice.customer_id);
    if (!customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    const report = serviceReports.find(r => r.id === invoice.service_report_id);
    const reportParts = partsOrders.filter(p => p.service_report_id === invoice.service_report_id);

    let emailBody = `
Dear ${customer.contact_name || customer.company_name},

Please find your invoice details below:

INVOICE: ${invoice.invoice_number}
Date: ${format(new Date(invoice.invoice_date), 'MMMM d, yyyy')}
Due Date: ${format(new Date(invoice.due_date), 'MMMM d, yyyy')}

-------------------------------------------
CHARGES:
-------------------------------------------
`;

    if (report) {
      emailBody += `\nService Date: ${format(new Date(report.service_date), 'MMMM d, yyyy')}\n`;
      if (report.equipment_type) {
        emailBody += `Equipment: ${report.equipment_type} ${report.equipment_make || ''} ${report.equipment_model || ''}\n`;
      }
      emailBody += `\n`;
    }

    emailBody += `Labor Total: $${(invoice.labor_total || 0).toFixed(2)}\n`;
    emailBody += `Travel Total: $${(invoice.travel_total || 0).toFixed(2)}\n`;
    
    if (reportParts.length > 0) {
      emailBody += `\nParts:\n`;
      reportParts.forEach(part => {
        const cost = (part.unit_cost || 0) * (part.quantity || 1);
        const markup = cost * ((part.markup_percent || 0) / 100);
        emailBody += `  - ${part.part_description} (Qty: ${part.quantity}): $${(cost + markup).toFixed(2)}\n`;
      });
    }
    emailBody += `Parts Total: $${(invoice.parts_total || 0).toFixed(2)}\n`;

    if (invoice.tax_rate > 0) {
      emailBody += `\nTax (${invoice.tax_rate}%): $${(invoice.tax_amount || 0).toFixed(2)}\n`;
    }

    emailBody += `\n-------------------------------------------\n`;
    emailBody += `TOTAL DUE: $${(invoice.total_amount || 0).toFixed(2)}\n`;
    emailBody += `-------------------------------------------\n\n`;

    if (invoice.notes) {
      emailBody += `Notes: ${invoice.notes}\n\n`;
    }

    // Add payment link
    const paymentUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/PayInvoice')}?invoice_id=${invoice.id}`;
    emailBody += `\nPay Online: ${paymentUrl}\n\n`;

    emailBody += `Thank you for your business!\n\nDieselTech Field Service`;

    try {
      await base44.integrations.Core.SendEmail({
        to: customer.email,
        subject: `Invoice ${invoice.invoice_number} from DieselTech`,
        body: emailBody
      });

      // Update invoice status to 'sent' if it was draft
      if (invoice.status === 'draft') {
        await base44.entities.Invoice.update(invoice.id, { status: 'sent' });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }

      toast.success(`Invoice sent to ${customer.email}`);
    } catch (error) {
      toast.error('Failed to send email');
    }
  }, [customers, serviceReports, partsOrders, queryClient]);

  const statusColors = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    partially_paid: "bg-amber-100 text-amber-700"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-1">Create and manage invoices</p>
        </div>
        <Button 
          onClick={() => { setEditingInvoice(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="partially_paid">Partial</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Customer</Label>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Start Date</Label>
            <Input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">End Date</Label>
            <Input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {(customerFilter !== 'all' || startDate || endDate) && (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setCustomerFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </Button>
            <span className="text-sm text-slate-500">
              {filteredInvoices.length} {filteredInvoices.length === 1 ? 'invoice' : 'invoices'} found
            </span>
          </div>
        )}
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search || statusFilter !== 'all' ? 'No invoices found' : 'No invoices yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button 
                variant="link" 
                className="text-amber-600 mt-2"
                onClick={() => setShowForm(true)}
              >
                Create your first invoice
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <Card 
              key={invoice.id} 
              className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => { setEditingInvoice(invoice); setShowForm(true); }}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-6 h-6 text-green-600" />
                  </div>
                  
                   <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {getCustomerName(invoice.customer_id)}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {invoice.invoice_number && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {invoice.invoice_number}
                            </span>
                          )}
                          {invoice.invoice_date && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(invoice.invoice_date), 'MMM d, yyyy')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge className={statusColors[invoice.status]}>
                          {invoice.status}
                        </Badge>
                        <p className="text-xl font-bold text-slate-900 mt-2">
                          ${(invoice.total_amount || 0).toFixed(2)}
                        </p>
                        {invoice.discount_percent > 0 && (
                          <p className="text-xs text-green-600">
                            {invoice.discount_percent}% discount
                          </p>
                        )}
                        {invoice.manual_price_override && (
                          <p className="text-xs text-purple-600">
                            Manual override
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                   <Button 
                     variant="ghost" 
                     size="icon"
                     onClick={() => handlePrintInvoice(invoice.id)}
                     title="Download/Print PDF"
                   >
                     <Printer className="w-4 h-4 text-slate-600" />
                   </Button>
                   {invoice.status !== 'paid' && (
                     <Button 
                       variant="ghost" 
                       size="icon"
                       onClick={() => handleGeneratePaymentLink(invoice)}
                       title="Copy payment link"
                     >
                       <LinkIcon className="w-4 h-4 text-purple-500" />
                     </Button>
                   )}
                   <Button 
                     variant="ghost" 
                     size="icon"
                     onClick={() => handleSendEmail(invoice)}
                     title="Send invoice via email"
                   >
                     <Send className="w-4 h-4 text-blue-500" />
                   </Button>

                    {invoice.status !== 'paid' && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => { setPayingInvoice(invoice); setShowPayment(true); }}
                      >
                        <CreditCard className="w-4 h-4 text-green-500" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setInvoiceToDelete(invoice)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invoice Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice?.id ? 'Edit Invoice' : 'Create Invoice'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingInvoice?.job_id && (
              <PrepaymentSummary 
                jobId={editingInvoice.job_id} 
                invoiceId={editingInvoice.id}
              />
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input 
                  id="invoice_number" 
                  name="invoice_number"
                  defaultValue={editingInvoice?.invoice_number || generateInvoiceNumber()}
                />
              </div>
              <div>
                <Label>Customer *</Label>
                <Select name="customer_id" defaultValue={editingInvoice?.customer_id || ''} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice_date">Invoice Date</Label>
                <Input 
                  id="invoice_date" 
                  name="invoice_date" 
                  type="date"
                  defaultValue={editingInvoice?.invoice_date || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input 
                  id="due_date" 
                  name="due_date" 
                  type="date"
                  defaultValue={editingInvoice?.due_date || format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Charges</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="labor_total">Labor Total ($)</Label>
                  <Input 
                    id="labor_total" 
                    name="labor_total" 
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice?.labor_total || 0}
                  />
                </div>
                <div>
                  <Label htmlFor="travel_total">Travel Total ($)</Label>
                  <Input 
                    id="travel_total" 
                    name="travel_total" 
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice?.travel_total || 0}
                  />
                </div>
                <div>
                  <Label htmlFor="parts_total">Parts Total ($)</Label>
                  <Input 
                    id="parts_total" 
                    name="parts_total" 
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice?.parts_total || 0}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Adjustments</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount_percent">Discount (%)</Label>
                  <Input 
                    id="discount_percent" 
                    name="discount_percent" 
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice?.discount_percent || 0}
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500 mt-1">Applied before tax</p>
                </div>
                <div>
                  <Label htmlFor="manual_price_override">Manual Price Override ($)</Label>
                  <Input 
                    id="manual_price_override" 
                    name="manual_price_override" 
                    type="number"
                    step="0.01"
                    defaultValue={editingInvoice?.manual_price_override || ''}
                    placeholder="Leave blank for auto-calc"
                  />
                  <p className="text-xs text-slate-500 mt-1">Overrides all calculations</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input 
                  id="tax_rate" 
                  name="tax_rate" 
                  type="number"
                  step="0.01"
                  defaultValue={editingInvoice?.tax_rate || 0}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editingInvoice?.status || 'draft'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes"
                defaultValue={editingInvoice?.notes}
                placeholder="Payment terms, additional details..."
                rows={3}
              />
            </div>

            <input type="hidden" name="service_report_id" value={editingInvoice?.service_report_id || ''} />

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
                className="bg-amber-500 hover:bg-amber-600"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingInvoice?.id ? 'Save Changes' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          
          {payingInvoice && (
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Invoice Total</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${(payingInvoice.total_amount || 0).toFixed(2)}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {getCustomerName(payingInvoice.customer_id)}
                </p>
              </div>

              <div>
                <Label>Payment Method</Label>
                <Select name="payment_method" defaultValue="cash">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input 
                  id="payment_date" 
                  name="payment_date" 
                  type="date"
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <Label htmlFor="payment_reference">Reference (Check #, Transaction ID)</Label>
                <Input 
                  id="payment_reference" 
                  name="payment_reference"
                  placeholder="Optional"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setShowPayment(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={updateMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Paid
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
        </Dialog>

      <DeleteConfirmationDialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
        title="Delete Invoice?"
        description={invoiceToDelete?.status === 'paid' ?
          "This invoice has been paid." :
          "This invoice will be permanently deleted."}
        warning={invoiceToDelete?.status !== 'draft' ?
          `⚠️ This invoice is ${invoiceToDelete?.status}. Are you sure?` : null}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (invoiceToDelete) {
            deleteMutation.mutate(invoiceToDelete.id);
          }
        }}
      />
    </div>
  );
}