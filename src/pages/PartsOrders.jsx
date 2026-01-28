import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
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
  Package,
  Pencil,
  Trash2,
  DollarSign,
  Hash,
  Printer,
  Settings
} from "lucide-react";
import PartsAvailabilityChecker from '@/components/parts/PartsAvailabilityChecker';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import CustomerSelect from '@/components/customers/CustomerSelect';
import { toast } from "sonner";
import { calculatePartsMarkup, calculatePartTotal } from '../components/parts/partsMarkupCalculator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PartsOrders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [selectedParts, setSelectedParts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [markupSettings, setMarkupSettings] = useState({ max_markup: 45, min_markup: 12, decay_rate: 200 });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const urlParams = new URLSearchParams(window.location.search);
  const shouldOpenNew = urlParams.get('new') === 'true';

  useEffect(() => {
    if (shouldOpenNew) {
      setShowForm(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [shouldOpenNew]);

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['partsOrders'],
    queryFn: () => base44.entities.PartsOrder.list('-created_date')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date')
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['markupSettings'],
    queryFn: () => base44.entities.MarkupSettings.list()
  });

  useEffect(() => {
    if (settings && settings.length > 0) {
      setMarkupSettings(settings[0]);
    }
  }, [settings]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PartsOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
      setShowForm(false);
      setEditingPart(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PartsOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
      setShowForm(false);
      setEditingPart(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PartsOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const settingsId = settings?.[0]?.id;
      let result;
      if (settingsId) {
        result = await base44.entities.MarkupSettings.update(settingsId, data);
      } else {
        result = await base44.entities.MarkupSettings.create(data);
      }
      
      // Update all existing parts with new markup calculations
      const updatePromises = parts.map(part => {
        if (part.unit_cost && part.unit_cost > 0) {
          const newMarkup = calculatePartsMarkup(part.unit_cost, data);
          return base44.entities.PartsOrder.update(part.id, {
            ...part,
            markup_percent: newMarkup
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markupSettings'] });
      queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
      setShowSettings(false);
      toast.success('Markup settings and all parts updated');
    }
  });

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'N/A';
  };

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ownVehicles'],
    queryFn: () => base44.entities.OwnVehicle.list()
  });

  const getServiceReportLabel = (reportId) => {
    const report = serviceReports.find(r => r.id === reportId);
    if (!report) return 'N/A';
    const customer = customers.find(c => c.id === report.customer_id);
    return `${customer?.company_name || 'Unknown'} - ${format(new Date(report.service_date), 'MMM d, yyyy')}`;
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle?.name || 'N/A';
  };

  const filteredParts = parts.filter(p => {
    const matchesSearch = 
      p.part_description?.toLowerCase().includes(search.toLowerCase()) ||
      p.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesReport = reportFilter === 'all' || p.service_report_id === reportFilter;
    return matchesSearch && matchesStatus && matchesReport;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get uploaded receipt URL if exists
    const receiptInput = e.target.querySelector('#receipt_url');
    const receiptUrl = receiptInput?.getAttribute('data-url') || editingPart?.receipt_url || '';
    
    const data = {
      ...Object.fromEntries(formData),
      quantity: parseFloat(formData.get('quantity')) || 1,
      unit_cost: parseFloat(formData.get('unit_cost')) || 0,
      markup_percent: parseFloat(formData.get('markup_percent')) || 25,
      receipt_url: receiptUrl
    };
    
    if (editingPart) {
      updateMutation.mutate({ id: editingPart.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const statusColors = {
    needed: "bg-red-100 text-red-700",
    ordered: "bg-yellow-100 text-yellow-700",
    received: "bg-blue-100 text-blue-700",
    installed: "bg-green-100 text-green-700"
  };

  const calculateTotal = (part) => {
    return calculatePartTotal(
      part.unit_cost || 0,
      part.quantity || 1,
      part.markup_percent || 0
    );
  };

  const handlePrintOrders = async () => {
    if (selectedParts.length === 0) {
      toast.error('Please select parts to print');
      return;
    }

    try {
      const response = await base44.functions.invoke('generatePartsOrderPDF', { part_ids: selectedParts });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parts-order-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Parts order form downloaded');
      setSelectedParts([]);
    } catch (error) {
      toast.error('Failed to generate order form');
    }
  };

  const togglePartSelection = (partId) => {
    setSelectedParts(prev => 
      prev.includes(partId) ? prev.filter(id => id !== partId) : [...prev, partId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Orders</h1>
          <p className="text-slate-500 mt-1">Track parts and orders</p>
        </div>
        <div className="flex gap-2">
          {currentUser?.role === 'admin' && (
            <Button 
              onClick={() => setShowSettings(true)}
              variant="outline"
            >
              <Settings className="w-4 h-4 mr-2" />
              Markup Settings
            </Button>
          )}
          {selectedParts.length > 0 && (
            <Button 
              onClick={handlePrintOrders}
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Order ({selectedParts.length})
            </Button>
          )}
          <Button 
            onClick={() => { setEditingPart(null); setShowForm(true); }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Part
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={reportFilter} onValueChange={setReportFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filter by service report" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reports</SelectItem>
            {serviceReports.map((report) => (
              <SelectItem key={report.id} value={report.id}>
                {getServiceReportLabel(report.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="needed">Needed</TabsTrigger>
            <TabsTrigger value="ordered">Ordered</TabsTrigger>
            <TabsTrigger value="received">Received</TabsTrigger>
            <TabsTrigger value="installed">Installed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Parts List */}
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
      ) : filteredParts.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search || statusFilter !== 'all' ? 'No parts found' : 'No parts orders yet'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button 
                variant="link" 
                className="text-amber-600 mt-2"
                onClick={() => setShowForm(true)}
              >
                Add your first part
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredParts.map((part) => (
            <Card key={part.id} className={`border-0 shadow-sm hover:shadow-md transition-all ${selectedParts.includes(part.id) ? 'ring-2 ring-amber-400' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => togglePartSelection(part.id)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedParts.includes(part.id) 
                        ? 'bg-amber-100 ring-2 ring-amber-400' 
                        : 'bg-purple-100'
                    }`}
                  >
                    <Package className={`w-6 h-6 ${selectedParts.includes(part.id) ? 'text-amber-600' : 'text-purple-600'}`} />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {part.part_description}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {part.part_number && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {part.part_number}
                            </span>
                          )}
                          {part.supplier && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{part.supplier}</span>
                            </>
                          )}
                          <span className="text-slate-300">•</span>
                          <span>Qty: {part.quantity}</span>
                        </div>
                        {part.customer_id && (
                          <p className="text-sm text-slate-400 mt-1">
                            For: {getCustomerName(part.customer_id)}
                          </p>
                        )}
                        {part.service_report_id && (
                          <p className="text-sm text-blue-600 mt-1">
                            Report: {getServiceReportLabel(part.service_report_id)}
                          </p>
                        )}
                        {part.own_vehicle_id && (
                          <p className="text-sm text-purple-600 mt-1">
                            Vehicle: {getVehicleName(part.own_vehicle_id)}
                            {part.paid_by && (
                              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-purple-100">
                                {part.paid_by === 'company' ? 'Company Paid' : 'Technician Paid'}
                              </span>
                            )}
                          </p>
                        )}
                        <div className="mt-2">
                          <PartsAvailabilityChecker 
                            partNumber={part.part_number}
                            partDescription={part.part_description}
                          />
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <Badge className={statusColors[part.status]}>
                          {part.status}
                        </Badge>
                        <p className="text-lg font-semibold text-slate-900 mt-2">
                          ${calculateTotal(part).toFixed(2)}
                        </p>
                        {part.quantity > 1 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            ${(calculateTotal(part) / part.quantity).toFixed(2)} / unit
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setEditingPart(part); setShowForm(true); }}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteMutation.mutate(part.id)}
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

      {/* Parts Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPart ? 'Edit Part' : 'Add New Part'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="part_description">Description *</Label>
              <Input 
                id="part_description" 
                name="part_description" 
                required
                defaultValue={editingPart?.part_description}
                placeholder="Fuel filter, injector, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="part_number">Part Number</Label>
                <Input 
                  id="part_number" 
                  name="part_number"
                  defaultValue={editingPart?.part_number}
                  placeholder="CAT-123-456"
                />
              </div>
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input 
                  id="supplier" 
                  name="supplier"
                  defaultValue={editingPart?.supplier}
                  placeholder="Caterpillar"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input 
                  id="quantity" 
                  name="quantity" 
                  type="number"
                  min="1"
                  defaultValue={editingPart?.quantity || 1}
                />
              </div>
              <div>
                <Label htmlFor="unit_cost">Unit Cost ($)</Label>
                <Input 
                  id="unit_cost" 
                  name="unit_cost" 
                  type="number"
                  step="0.01"
                  defaultValue={editingPart?.unit_cost}
                  placeholder="0.00"
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    const markupField = document.getElementById('markup_percent');
                    if (markupField) {
                      markupField.value = calculatePartsMarkup(cost, markupSettings);
                    }
                  }}
                />
              </div>
              <div>
                <Label htmlFor="markup_percent">Markup % <span className="text-xs text-slate-400">(auto)</span></Label>
                <Input 
                  id="markup_percent" 
                  name="markup_percent" 
                  type="number"
                  step="0.1"
                  defaultValue={editingPart?.markup_percent || 25}
                  className="bg-blue-50"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjusts by cost
                </p>
              </div>
            </div>

            <div>
              <Label>Service Report</Label>
              <Select name="service_report_id" defaultValue={editingPart?.service_report_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Link to service report (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {serviceReports.map((report) => (
                    <SelectItem key={report.id} value={report.id}>
                      {getServiceReportLabel(report.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Customer</Label>
              <Select name="customer_id" defaultValue={editingPart?.customer_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
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

            <div>
              <Label>Our Vehicle (Internal Repair)</Label>
              <Select name="own_vehicle_id" defaultValue={editingPart?.own_vehicle_id || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} {vehicle.vehicle_owner === 'personal' ? '(Personal)' : '(Company)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingPart?.own_vehicle_id && (
              <div>
                <Label>Who Paid?</Label>
                <Select name="paid_by" defaultValue={editingPart?.paid_by || 'company'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.find(v => v.id === editingPart.own_vehicle_id)?.vehicle_owner === 'personal' ? (
                      <>
                        <SelectItem value="company">Wehmann Paid</SelectItem>
                        <SelectItem value="technician">Technician Paid</SelectItem>
                        <SelectItem value="third_party">Third Party Paid</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="company">Company Paid</SelectItem>
                        <SelectItem value="third_party">Third Party Paid</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={editingPart?.status || 'needed'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="needed">Needed</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="installed">Installed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order_date">Order Date</Label>
              <Input 
                id="order_date" 
                name="order_date" 
                type="date"
                defaultValue={editingPart?.order_date}
              />
            </div>

            <div>
              <Label htmlFor="receipt_url">Receipt Upload</Label>
              <Input 
                id="receipt_url" 
                name="receipt_url" 
                type="file"
                accept="image/*,.pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      e.target.setAttribute('data-url', file_url);
                    } catch (error) {
                      toast.error('Failed to upload receipt');
                    }
                  }
                }}
              />
              {editingPart?.receipt_url && (
                <a 
                  href={editingPart.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  View current receipt
                </a>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes"
                defaultValue={editingPart?.notes}
                placeholder="Additional notes..."
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
                className="bg-amber-500 hover:bg-amber-600"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingPart ? 'Save Changes' : 'Add Part'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Markup Settings Dialog (Admin Only) */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Parts Markup Equation Settings</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newSettings = {
              max_markup: parseFloat(formData.get('max_markup')),
              min_markup: parseFloat(formData.get('min_markup')),
              decay_rate: parseFloat(formData.get('decay_rate')),
              service_company: currentUser?.current_company || currentUser?.company
            };
            
            // Validate: ensure pricing curve is monotonically increasing
            const testCosts = [10, 50, 100, 200, 500, 1000, 2000, 5000];
            const prices = testCosts.map(cost => 
              cost * (1 + calculatePartsMarkup(cost, newSettings) / 100)
            );
            
            for (let i = 1; i < prices.length; i++) {
              if (prices[i] <= prices[i-1]) {
                toast.error('Invalid settings: cheaper parts would have higher prices than expensive parts. Adjust your decay rate.');
                return;
              }
            }
            
            saveSettingsMutation.mutate(newSettings);
          }} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-2">
                <strong>Formula:</strong> markup = min + (max - min) × e<sup>(-cost/decay)</sup>
              </p>
              <p className="text-xs text-slate-500">
                This creates a smooth curve where cheap parts get higher markup and expensive parts get lower markup.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_markup">Maximum Markup %</Label>
                <Input 
                  id="max_markup" 
                  name="max_markup" 
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  value={markupSettings.max_markup}
                  onChange={(e) => setMarkupSettings({...markupSettings, max_markup: parseFloat(e.target.value) || 0})}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">For cheap parts (~$10)</p>
              </div>

              <div>
                <Label htmlFor="min_markup">Minimum Markup %</Label>
                <Input 
                  id="min_markup" 
                  name="min_markup" 
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  value={markupSettings.min_markup}
                  onChange={(e) => setMarkupSettings({...markupSettings, min_markup: parseFloat(e.target.value) || 0})}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">For expensive parts (~$2000+)</p>
              </div>
            </div>

            <div>
              <Label htmlFor="decay_rate">Decay Rate (Curve Steepness)</Label>
              <Input 
                id="decay_rate" 
                name="decay_rate" 
                type="range"
                min="50"
                max="1000"
                step="10"
                value={markupSettings.decay_rate}
                onChange={(e) => setMarkupSettings({...markupSettings, decay_rate: parseFloat(e.target.value)})}
                required
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Fast transition ({markupSettings.decay_rate})</span>
                <span>Slow transition</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Lower = markup drops quickly. Higher = markup stays high longer.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">Markup Curve Preview:</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={[0, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000].map(cost => ({
                    cost,
                    markup: calculatePartsMarkup(cost, {
                      max_markup: markupSettings.max_markup,
                      min_markup: markupSettings.min_markup,
                      decay_rate: markupSettings.decay_rate
                    })
                  }))}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis 
                    dataKey="cost" 
                    stroke="#64748b" 
                    fontSize={10}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    formatter={(value) => `${value}% markup`}
                    labelFormatter={(label) => `$${label} part`}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="markup" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1 text-xs text-blue-800">
                <p>$25 → {calculatePartsMarkup(25, markupSettings)}%</p>
                <p>$100 → {calculatePartsMarkup(100, markupSettings)}%</p>
                <p>$500 → {calculatePartsMarkup(500, markupSettings)}%</p>
                <p>$1500 → {calculatePartsMarkup(1500, markupSettings)}%</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-amber-500 hover:bg-amber-600"
                disabled={saveSettingsMutation.isPending}
              >
                Save Settings
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}