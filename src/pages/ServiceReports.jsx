import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar,
  Truck,
  Pencil,
  Trash2,
  Receipt
} from "lucide-react";
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import ServiceReportForm from '@/components/service/ServiceReportForm';
import MobileServiceForm from '@/components/service/MobileServiceForm';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';

export default function ServiceReports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');
  const shouldOpenNew = urlParams.get('new') === 'true';
  const preselectedCustomer = urlParams.get('customer');
  const isMobile = window.innerWidth < 768;

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: async () => {
      if (currentUser?.user_type === 'service_customer') {
        return base44.entities.ServiceReport.filter({ created_by: currentUser.email }, '-created_date');
      }
      return base44.entities.ServiceReport.list('-created_date');
    },
    enabled: !!currentUser
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      if (currentUser?.user_type === 'service_customer') {
        return base44.entities.Customer.filter({ created_by: currentUser.email });
      }
      return base44.entities.Customer.list();
    },
    enabled: !!currentUser
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {}
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (shouldOpenNew) {
      const newReport = preselectedCustomer ? { customer_id: preselectedCustomer } : null;
      setEditingReport(newReport);
      setShowForm(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (reportId) {
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setEditingReport(report);
        setShowForm(true);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [shouldOpenNew, reportId, reports, preselectedCustomer]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ServiceReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceReports'] });
      setShowForm(false);
      setEditingReport(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ServiceReport.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceReports'] });
      setShowForm(false);
      setEditingReport(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceReports'] });
    }
  });

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown Customer';
  };

  const uniqueEquipmentTypes = [...new Set(reports.map(r => r.equipment_type).filter(Boolean))].sort();

  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      getCustomerName(r.customer_id).toLowerCase().includes(search.toLowerCase()) ||
      r.equipment_type?.toLowerCase().includes(search.toLowerCase()) ||
      r.equipment_make?.toLowerCase().includes(search.toLowerCase()) ||
      r.equipment_serial?.toLowerCase().includes(search.toLowerCase()) ||
      r.complaint?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || r.customer_id === customerFilter;
    const matchesEquipment = equipmentFilter === 'all' || r.equipment_type === equipmentFilter;
    
    const matchesDateRange = (!startDate || !endDate) || (
      r.service_date && 
      new Date(r.service_date) >= new Date(startDate) && 
      new Date(r.service_date) <= new Date(endDate)
    );
    
    return matchesSearch && matchesStatus && matchesCustomer && matchesEquipment && matchesDateRange;
  });

  const handleSave = (data) => {
    if (editingReport?.id) {
      updateMutation.mutate({ id: editingReport.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleComplete = async (data) => {
    // First complete the report
    const completedData = { ...data, status: 'completed' };
    if (editingReport?.id) {
      await updateMutation.mutateAsync({ id: editingReport.id, data: completedData });
    } else {
      await createMutation.mutateAsync(completedData);
    }
    
    // Then auto-generate invoice
    const reportId = editingReport?.id || data.id;
    if (reportId) {
      const url = createPageUrl('Invoices') + `?from_report=${reportId}&auto_generate=true`;
      window.location.href = url;
    }
  };

  const statusColors = {
    draft: "bg-slate-100 text-slate-700",
    completed: "bg-blue-100 text-blue-700",
    invoiced: "bg-green-100 text-green-700"
  };

  if (showForm) {
    const FormComponent = isMobile ? MobileServiceForm : ServiceReportForm;
    return (
      <FormComponent 
        report={editingReport}
        customers={customers}
        onSave={handleSave}
        onComplete={handleComplete}
        onBack={() => { setShowForm(false); setEditingReport(null); }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Reports</h1>
          <p className="text-slate-500 mt-1">Document your service calls</p>
        </div>
        <Button 
          onClick={() => { setEditingReport(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="invoiced">Invoiced</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Customer</Label>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Equipment Type</Label>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {uniqueEquipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
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

        {(customerFilter !== 'all' || equipmentFilter !== 'all' || startDate || endDate) && (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setCustomerFilter('all');
                setEquipmentFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </Button>
            <span className="text-sm text-slate-500">
              {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'} found
            </span>
          </div>
        )}
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search || statusFilter !== 'all' ? 'No reports found' : 'No service reports yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button 
                variant="link" 
                className="text-amber-600 mt-2"
                onClick={() => setShowForm(true)}
              >
                Create your first report
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-amber-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {getCustomerName(report.customer_id)}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {report.equipment_type && (
                            <span>{report.equipment_type}</span>
                          )}
                          {report.equipment_make && report.equipment_model && (
                            <span className="text-slate-300">•</span>
                          )}
                          {(report.equipment_make || report.equipment_model) && (
                            <span>{[report.equipment_make, report.equipment_model].filter(Boolean).join(' ')}</span>
                          )}
                        </div>
                        {report.service_date && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-slate-400">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.service_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[report.status]}>
                          {report.status}
                        </Badge>
                      </div>
                    </div>

                    {report.complaint && (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                        {report.complaint}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setEditingReport(report); setShowForm(true); }}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                    {report.status === 'completed' && (
                      <Link to={createPageUrl('Invoices') + `?from_report=${report.id}`}>
                        <Button variant="ghost" size="icon">
                          <Receipt className="w-4 h-4 text-green-500" />
                        </Button>
                      </Link>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setReportToDelete(report)}
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

        <DeleteConfirmationDialog
        open={!!reportToDelete}
        onOpenChange={(open) => !open && setReportToDelete(null)}
        title="Delete Service Report?"
        description={reportToDelete?.status === 'completed' ? 
          "This report is completed. Deleting it will affect invoicing." : 
          "This service report will be permanently deleted."}
        warning={reportToDelete?.status === 'completed' ? 
          "⚠️ This report has been completed. Are you sure?" : null}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (reportToDelete) {
            deleteMutation.mutate(reportToDelete.id);
          }
        }}
        />
        </div>
        );
        }