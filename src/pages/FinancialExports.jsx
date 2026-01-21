import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Download,
  Calendar,
  DollarSign,
  FileSpreadsheet
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function FinancialExports() {
  const [currentUser, setCurrentUser] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCustomerCompany, setSelectedCustomerCompany] = useState('');
  const navigate = useNavigate();

  const managedCompanies = (currentUser?.companies_managed || []).filter(Boolean);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      }
    };
    loadUser();

    // Default to current year
    const now = new Date();
    setStartDate(format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'));
    setEndDate(format(now, 'yyyy-MM-dd'));
  }, []);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: partsOrders = [] } = useQuery({
    queryKey: ['partsOrders'],
    queryFn: () => base44.entities.PartsOrder.list()
  });

  const customerCompanies = [...new Set(customers.map(c => c.company_name))].filter(Boolean).sort();

  const filterByDate = (items, dateField) => {
    if (!startDate || !endDate) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  };

  const filterByCustomerCompany = (items, customerIdField) => {
    if (!selectedCustomerCompany) return items;
    return items.filter(item => {
      const customer = customers.find(c => c.id === item[customerIdField]);
      return customer?.company_name === selectedCustomerCompany;
    });
  };

  const exportInvoices = () => {
    let filtered = filterByDate(invoices, 'invoice_date');
    filtered = filterByCustomerCompany(filtered, 'customer_id');
    const headers = [
      'Invoice Number',
      'Customer',
      'Invoice Date',
      'Due Date',
      'Labor Total',
      'Travel Total',
      'Parts Total',
      'Tax Amount',
      'Total Amount',
      'Status',
      'Payment Date',
      'Payment Method',
      'Payment Reference'
    ];
    
    const rows = filtered.map(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      return [
        inv.invoice_number || '',
        customer?.company_name || '',
        inv.invoice_date || '',
        inv.due_date || '',
        inv.labor_total || 0,
        inv.travel_total || 0,
        inv.parts_total || 0,
        inv.tax_amount || 0,
        inv.total_amount || 0,
        inv.status || '',
        inv.payment_date || '',
        inv.payment_method || '',
        inv.payment_reference || ''
      ];
    });
    
    downloadCSV(headers, rows, 'invoices');
    toast.success(`Exported ${filtered.length} invoices`);
  };

  const exportServiceReports = () => {
    let filtered = filterByDate(serviceReports, 'service_date');
    filtered = filterByCustomerCompany(filtered, 'customer_id');
    const headers = [
      'Service Date',
      'Customer',
      'Equipment Type',
      'Equipment Make',
      'Equipment Model',
      'Equipment Serial',
      'Equipment Hours',
      'Work Performed',
      'Labor Total',
      'Travel Mileage',
      'Travel Total',
      'Status',
      'Created By',
      'Created Date'
    ];
    
    const rows = filtered.map(report => {
      const customer = customers.find(c => c.id === report.customer_id);
      const laborTotal = (report.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const travelTotal = report.destination_fee?.total || 0;
      
      return [
        report.service_date || '',
        customer?.company_name || '',
        report.equipment_type || '',
        report.equipment_make || '',
        report.equipment_model || '',
        report.equipment_serial || '',
        report.equipment_hours || '',
        report.work_performed || '',
        laborTotal,
        report.destination_fee?.mileage || 0,
        travelTotal,
        report.status || '',
        report.created_by || '',
        format(new Date(report.created_date), 'yyyy-MM-dd')
      ];
    });
    
    downloadCSV(headers, rows, 'service-reports');
    toast.success(`Exported ${filtered.length} service reports`);
  };

  const exportPayments = () => {
    let paidInvoices = filterByDate(
      invoices.filter(inv => inv.status === 'paid' && inv.payment_date),
      'payment_date'
    );
    paidInvoices = filterByCustomerCompany(paidInvoices, 'customer_id');
    
    const headers = [
      'Payment Date',
      'Invoice Number',
      'Customer',
      'Payment Method',
      'Payment Reference',
      'Amount Paid',
      'Labor',
      'Travel',
      'Parts',
      'Tax'
    ];
    
    const rows = paidInvoices.map(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      return [
        inv.payment_date,
        inv.invoice_number || '',
        customer?.company_name || '',
        inv.payment_method || '',
        inv.payment_reference || '',
        inv.total_amount || 0,
        inv.labor_total || 0,
        inv.travel_total || 0,
        inv.parts_total || 0,
        inv.tax_amount || 0
      ];
    });
    
    downloadCSV(headers, rows, 'payments');
    toast.success(`Exported ${paidInvoices.length} payments`);
  };

  const exportTaxReport = () => {
    const filtered = filterByDate(invoices, 'invoice_date');
    const headers = [
      'Invoice Date',
      'Invoice Number',
      'Customer',
      'Customer Address',
      'Subtotal (Labor)',
      'Subtotal (Travel)',
      'Subtotal (Parts)',
      'Total Before Tax',
      'Tax Rate',
      'Tax Amount',
      'Total Amount',
      'Status'
    ];
    
    const rows = filtered.map(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      const subtotal = (inv.labor_total || 0) + (inv.travel_total || 0) + (inv.parts_total || 0);
      const address = [customer?.address, customer?.city, customer?.state, customer?.zip]
        .filter(Boolean)
        .join(', ');
      
      return [
        inv.invoice_date || '',
        inv.invoice_number || '',
        customer?.company_name || '',
        address,
        inv.labor_total || 0,
        inv.travel_total || 0,
        inv.parts_total || 0,
        subtotal,
        inv.tax_rate || 0,
        inv.tax_amount || 0,
        inv.total_amount || 0,
        inv.status || ''
      ];
    });
    
    downloadCSV(headers, rows, 'tax-report');
    toast.success(`Exported tax report with ${filtered.length} invoices`);
  };

  const exportComprehensive = () => {
    const filteredInvoices = filterByDate(invoices, 'invoice_date');
    const filteredReports = filterByDate(serviceReports, 'service_date');
    
    // Summary sheet
    const totalRevenue = filteredInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const totalPending = filteredInvoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    
    const headers = [
      'Summary Report',
      `Period: ${startDate} to ${endDate}`,
      '',
      'Metric',
      'Amount'
    ];
    
    const rows = [
      [''],
      ['Financial Summary', ''],
      ['Total Revenue (Paid)', '', '', '', totalRevenue],
      ['Pending Invoices', '', '', '', totalPending],
      ['Total Tax Collected', '', '', '', totalTax],
      ['Total Invoices', '', '', '', filteredInvoices.length],
      ['Total Service Reports', '', '', '', filteredReports.length],
      [''],
      [''],
      ['Detailed Invoice Data'],
      ['Invoice Number', 'Date', 'Customer', 'Labor', 'Travel', 'Parts', 'Tax', 'Total', 'Status', 'Payment Date'],
      ...filteredInvoices.map(inv => {
        const customer = customers.find(c => c.id === inv.customer_id);
        return [
          inv.invoice_number || '',
          inv.invoice_date || '',
          customer?.company_name || '',
          inv.labor_total || 0,
          inv.travel_total || 0,
          inv.parts_total || 0,
          inv.tax_amount || 0,
          inv.total_amount || 0,
          inv.status || '',
          inv.payment_date || ''
        ];
      })
    ];
    
    downloadCSV(headers, rows, 'comprehensive-financial-report');
    toast.success('Exported comprehensive financial report');
  };

  const downloadCSV = (headers, rows, filename) => {
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  // Check authorization after user loads
  if (currentUser.user_type !== 'service_admin' && currentUser.user_type !== 'bookkeeper' && currentUser.user_type !== 'software_engineer') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access financial exports.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const exportOptions = [
    {
      title: 'Invoice Export',
      description: 'Complete invoice data with payment information',
      icon: FileText,
      action: exportInvoices,
      color: 'bg-blue-500'
    },
    {
      title: 'Service Reports',
      description: 'Detailed service records with equipment and labor',
      icon: FileSpreadsheet,
      action: exportServiceReports,
      color: 'bg-green-500'
    },
    {
      title: 'Payment Records',
      description: 'All received payments with methods and references',
      icon: DollarSign,
      action: exportPayments,
      color: 'bg-amber-500'
    },
    {
      title: 'Tax Report',
      description: 'Tax summary with customer addresses and breakdowns',
      icon: Calendar,
      action: exportTaxReport,
      color: 'bg-purple-500'
    },
    {
      title: 'Comprehensive Report',
      description: 'All financial data in a single export',
      icon: Download,
      action: exportComprehensive,
      color: 'bg-slate-700'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Financial Exports</h1>
          <p className="text-slate-500 mt-1">Export financial data for bookkeeping and tax purposes</p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Select the period and company for your exports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              {(currentUser?.user_type === 'software_engineer' || currentUser?.user_type === 'bookkeeper') && managedCompanies.length > 0 && (
                <div>
                  <Label htmlFor="company">Service Company</Label>
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger id="company" className="mt-1">
                      <SelectValue placeholder="All companies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>All companies</SelectItem>
                      {managedCompanies.map((company) => (
                        <SelectItem key={company} value={company}>
                          {company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card key={option.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 ${option.color} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={option.action}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}