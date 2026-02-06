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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Package,
  Trash2,
  DollarSign,
  Hash,
  Printer,
  Settings,
  Check,
  Sparkles,
  Loader2,
  Shield
} from "lucide-react";
import PartsAvailabilityChecker from '@/components/parts/PartsAvailabilityChecker';
import PartsOrderReviewAssistant from '@/components/parts/PartsOrderReviewAssistant';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import CustomerSelect from '@/components/customers/CustomerSelect';
import FieldBenefitInfo from '@/components/service/FieldBenefitInfo';
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
  const [markupSettings, setMarkupSettings] = useState({ max_markup: 40, min_markup: 15, k: 0.01, inflection: 200 });
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [jobsList, setJobsList] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showReviewAssistant, setShowReviewAssistant] = useState(false);
  const [currentServiceReport, setCurrentServiceReport] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadJobsList = async () => {
      const fetchedJobs = await base44.entities.Job.list('-created_date');
      setJobsList(fetchedJobs);
    };
    loadJobsList();
  }, []);

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

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list()
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
    mutationFn: async (data) => {
      // Auto-create catalog entry if part has a part number
      if (data.part_number) {
        const existing = await base44.entities.PartsInventory.filter({
          part_number: data.part_number
        });
        
        if (existing.length === 0) {
          await base44.entities.PartsInventory.create({
            part_number: data.part_number,
            part_description: data.part_description,
            manufacturer: data.supplier,
            unit_cost: data.unit_cost,
            location: 'non_stock',
            quantity_on_hand: 0,
            notes: 'Auto-added from parts order'
          });
        }
      }
      
      return base44.entities.PartsOrder.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
      setShowForm(false);
      setEditingPart(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Auto-create catalog entry if part number is updated
      if (data.part_number) {
        const existing = await base44.entities.PartsInventory.filter({
          part_number: data.part_number
        });
        
        if (existing.length === 0) {
          await base44.entities.PartsInventory.create({
            part_number: data.part_number,
            part_description: data.part_description,
            manufacturer: data.supplier,
            unit_cost: data.unit_cost,
            location: 'non_stock',
            quantity_on_hand: 0,
            notes: 'Auto-added from parts order'
          });
        }
      }
      
      return base44.entities.PartsOrder.update(id, data);
    },
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
    const query = search.toLowerCase();
    const customer = customers.find(c => c.id === p.customer_id);
    const job = jobs.find(j => j.id === p.job_id);
    const vehicle = vehicles.find(v => v.id === p.own_vehicle_id);
    
    const matchesSearch = 
      p.part_description?.toLowerCase().includes(query) ||
      p.part_number?.toLowerCase().includes(query) ||
      p.supplier?.toLowerCase().includes(query) ||
      customer?.company_name?.toLowerCase().includes(query) ||
      job?.job_number?.toLowerCase().includes(query) ||
      vehicle?.name?.toLowerCase().includes(query) ||
      p.notes?.toLowerCase().includes(query) ||
      p.assignment_type?.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesReport = reportFilter === 'all' || p.service_report_id === reportFilter;
    return matchesSearch && matchesStatus && matchesReport;
  });

  const [assignmentType, setAssignmentType] = useState('service_report');
  const [catalogSaved, setCatalogSaved] = useState(false);

  useEffect(() => {
    if (editingPart) {
      setAssignmentType(editingPart.assignment_type || 'service_report');
    } else {
      setAssignmentType('service_report');
    }
    setCatalogSaved(false);
  }, [editingPart, showForm]);

  const handleSaveToCatalog = async (partData) => {
    try {
      // Check for existing part
      const existing = await base44.entities.PartsInventory.filter({
        part_number: partData.part_number
      });
      
      if (existing.length > 0) {
        toast.error(`Part ${partData.part_number} already exists in catalog`);
        return;
      }

      await base44.entities.PartsInventory.create({
        part_number: partData.part_number,
        part_description: partData.part_description,
        manufacturer: partData.supplier,
        unit_cost: partData.unit_cost,
        location: 'non_stock',
        quantity_on_hand: 0,
        notes: 'Added from parts order'
      });
      setCatalogSaved(true);
      toast.success('✓ Part saved to catalog as non-stock item');
    } catch (error) {
      toast.error('Failed to save to catalog');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get uploaded receipt URL if exists
    const receiptInput = e.target.querySelector('#receipt_url');
    const receiptUrl = receiptInput?.getAttribute('data-url') || editingPart?.receipt_url || '';
    
    const data = {
      ...Object.fromEntries(formData),
      assignment_type: assignmentType,
      quantity: parseFloat(formData.get('quantity')) || 1,
      unit_cost: parseFloat(formData.get('unit_cost')) || 0,
      shipping_cost: parseFloat(formData.get('shipping_cost')) || 0,
      markup_percent: parseFloat(formData.get('markup_percent')) || 25,
      receipt_url: receiptUrl,
      job_id: formData.get('job_id') === 'none' ? null : formData.get('job_id'),
      // Clear fields that don't apply to this assignment type
      service_report_id: assignmentType === 'service_report' ? formData.get('service_report_id') : null,
      customer_id: assignmentType === 'counter_sale' ? formData.get('customer_id') : null,
      own_vehicle_id: assignmentType === 'internal_vehicle' ? formData.get('own_vehicle_id') : null,
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
      part.markup_percent || 0,
      part.shipping_cost || 0
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

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setAiSearching(true);
    try {
      // Build enriched context for AI
      const enrichedParts = parts.map(p => {
        const customer = customers.find(c => c.id === p.customer_id);
        const job = jobs.find(j => j.id === p.job_id);
        const vehicle = vehicles.find(v => v.id === p.own_vehicle_id);
        
        return `- ${p.part_description} ${p.part_number ? `(#${p.part_number})` : ''} | ${p.supplier || 'No supplier'} | Status: ${p.status}${customer ? ` | Customer: ${customer.company_name}` : ''}${job ? ` | Job: ${job.job_number}` : ''}${vehicle ? ` | Vehicle: ${vehicle.name}` : ''}${p.assignment_type ? ` | Type: ${p.assignment_type}` : ''}`;
      });

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a parts search assistant. Analyze the user's query and return the best keyword to search for.

User query: "${aiQuery}"

Available parts with full context:
${enrichedParts.join('\n')}

Search across:
- Part descriptions and part numbers
- Suppliers/manufacturers
- Customer names
- Job numbers
- Vehicle names
- Assignment types (service_report, counter_sale, inventory, etc.)
- Status (needed, ordered, received, installed)

Return ONLY a single short keyword or phrase (2-4 words max) that would best match relevant parts. 
Examples: "filter", "injector", "J-2026-001", "Caterpillar", "John Deere", "Truck 1", "hydraulic"
If no match possible, return "NO_MATCH".`,
        add_context_from_internet: false
      });

      const keyword = response.trim();
      
      if (keyword === 'NO_MATCH' || !keyword) {
        toast.error('No matching parts found');
        setSearch('');
      } else {
        setSearch(keyword);
        setStatusFilter('all');
        setReportFilter('all');
        
        // Count matches with enhanced filtering
        const query = keyword.toLowerCase();
        const matches = parts.filter(p => {
          const customer = customers.find(c => c.id === p.customer_id);
          const job = jobs.find(j => j.id === p.job_id);
          const vehicle = vehicles.find(v => v.id === p.own_vehicle_id);
          
          return p.part_description?.toLowerCase().includes(query) ||
                 p.part_number?.toLowerCase().includes(query) ||
                 p.supplier?.toLowerCase().includes(query) ||
                 customer?.company_name?.toLowerCase().includes(query) ||
                 job?.job_number?.toLowerCase().includes(query) ||
                 vehicle?.name?.toLowerCase().includes(query) ||
                 p.assignment_type?.toLowerCase().includes(query);
        });
        
        if (matches.length > 0) {
          toast.success(`Found ${matches.length} matching part${matches.length !== 1 ? 's' : ''}`);
        } else {
          toast.error('No matching parts found');
        }
      }
    } catch (error) {
      console.error('AI search error:', error);
      toast.error('AI search failed');
    } finally {
      setAiSearching(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table { display: table !important; width: 100%; }
          body { padding: 20px; }
        }
      `}</style>
      
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Orders</h1>
          <p className="text-slate-500 mt-1">Track parts and orders</p>
        </div>
        <div className="flex gap-2 no-print">
          {currentUser?.role === 'admin' && (
            <Button 
              onClick={() => setShowSettings(true)}
              variant="outline"
            >
              <Settings className="w-4 h-4 mr-2" />
              Markup Settings
            </Button>
          )}
          <Button 
            onClick={() => window.print()}
            variant="outline"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print List
          </Button>
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

      {/* AI Search */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 no-print">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">AI Parts Search</h3>
        </div>
        <p className="text-sm text-slate-600 mb-3">Describe what you need, and AI will find matching parts</p>
        <div className="flex gap-2">
          <Input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="e.g., 'fuel filter for Caterpillar', 'injector parts', 'hydraulic hoses'"
            className="flex-1 bg-white"
            onKeyDown={(e) => e.key === 'Enter' && !aiSearching && handleAiSearch()}
          />
          <Button 
            onClick={handleAiSearch}
            disabled={aiSearching || !aiQuery.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {aiSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 no-print">
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

      {/* Parts List - Table View */}
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
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full print-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-12 no-print">
                  <input 
                    type="checkbox"
                    checked={filteredParts.length > 0 && selectedParts.length === filteredParts.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedParts(filteredParts.map(p => p.id));
                      } else {
                        setSelectedParts([]);
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Part</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assignment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredParts.map((part) => (
                <tr 
                  key={part.id} 
                  className={`hover:bg-slate-50 cursor-pointer ${selectedParts.includes(part.id) ? 'bg-amber-50' : ''}`}
                  onClick={() => { setEditingPart(part); setShowForm(true); }}
                >
                  <td className="px-4 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedParts.includes(part.id)}
                      onChange={() => togglePartSelection(part.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{part.part_description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        {part.part_number && (
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {part.part_number}
                          </span>
                        )}
                        {part.supplier && (
                          <>
                            <span>•</span>
                            <span>{part.supplier}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1">
                        <PartsAvailabilityChecker 
                          partNumber={part.part_number}
                          partDescription={part.part_description}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{part.quantity}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {part.customer_id && (
                        <p className="text-slate-600">{getCustomerName(part.customer_id)}</p>
                      )}
                      {part.service_report_id && (
                        <p className="text-blue-600 text-xs">{getServiceReportLabel(part.service_report_id)}</p>
                      )}
                      {part.own_vehicle_id && (
                        <p className="text-purple-600">{getVehicleName(part.own_vehicle_id)}</p>
                      )}
                      {!part.customer_id && !part.service_report_id && !part.own_vehicle_id && (
                        <span className="text-slate-400 text-xs capitalize">{part.assignment_type?.replace('_', ' ')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusColors[part.status]}>
                      {part.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-slate-900">
                      ${calculateTotal(part).toFixed(2)}
                    </p>
                    {part.quantity > 1 && (
                      <p className="text-xs text-slate-500">
                        ${(calculateTotal(part) / part.quantity).toFixed(2)} / unit
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right no-print" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDeleteConfirm(part)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shipping_cost">
                  Shipping Cost ($) 
                  {editingPart?.receipt_url && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="ml-2 h-6 text-xs text-blue-600"
                      onClick={async () => {
                        try {
                          const response = await base44.functions.invoke('distributeShippingCosts', {
                            receipt_url: editingPart.receipt_url
                          });
                          toast.success(`Distributed ${response.data.parts_updated} parts by value`);
                          queryClient.invalidateQueries({ queryKey: ['partsOrders'] });
                          setShowForm(false);
                        } catch (error) {
                          toast.error(error.message || 'Failed to distribute shipping');
                        }
                      }}
                    >
                      Distribute by Value
                    </Button>
                  )}
                </Label>
                <Input 
                  id="shipping_cost" 
                  name="shipping_cost" 
                  type="number"
                  step="0.01"
                  defaultValue={editingPart?.shipping_cost || 0}
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  Total receipt shipping (distributed by part value)
                </p>
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
              <Label>Assignment Type *</Label>
              <Select value={assignmentType} onValueChange={setAssignmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_report">Service Report</SelectItem>
                  <SelectItem value="counter_sale">Counter Sale (Customer)</SelectItem>
                  <SelectItem value="cash_sale">Cash Sale</SelectItem>
                  <SelectItem value="inventory">Inventory (Stock)</SelectItem>
                  <SelectItem value="internal_vehicle">Internal Vehicle Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link to Job (Optional)</Label>
              <Select name="job_id" defaultValue={editingPart?.job_id || 'none'}>
                <SelectTrigger>
                  <SelectValue placeholder="None or link to job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Job Link</SelectItem>
                  {jobsList.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.job_number} - {customers.find(c => c.id === job.customer_id)?.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignmentType === 'service_report' && (
              <div>
                <Label>Service Report</Label>
                <Select 
                  name="service_report_id" 
                  defaultValue={editingPart?.service_report_id || ''}
                  onValueChange={(val) => {
                    const report = serviceReports.find(r => r.id === val);
                    setCurrentServiceReport(report);
                    if (report && !editingPart) {
                      setShowReviewAssistant(true);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Will use same as job (if assigned)" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceReports.map((report) => (
                      <SelectItem key={report.id} value={report.id}>
                        {getServiceReportLabel(report.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Optional: Leave empty to automatically use the service report assigned to the job
                </p>
              </div>
            )}

            {showReviewAssistant && currentServiceReport && assignmentType === 'service_report' && (
              <PartsOrderReviewAssistant
                serviceReport={currentServiceReport}
                existingParts={parts.filter(p => p.service_report_id === currentServiceReport.id)}
                onAddSuggestion={(itemName, verificationSource) => {
                  const descField = document.querySelector('#part_description');
                  const verifyField = document.querySelector('#verification_source');
                  if (descField && !descField.value) {
                    descField.value = itemName;
                    if (verifyField && verificationSource) {
                      verifyField.value = verificationSource;
                    }
                    toast.success(`Added "${itemName}" to description`);
                  }
                }}
                autoCheck={true}
              />
            )}

            {assignmentType === 'counter_sale' && (
              <div>
                <Label>Customer *</Label>
                <Select name="customer_id" defaultValue={editingPart?.customer_id || ''}>
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
            )}

            {assignmentType === 'internal_vehicle' && (
              <div>
                <Label>Our Vehicle *</Label>
                <Select name="own_vehicle_id" defaultValue={editingPart?.own_vehicle_id || ''}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} {vehicle.vehicle_owner === 'personal' ? '(Personal)' : '(Company)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <div className="border-t pt-4 space-y-3 bg-green-50/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <p className="text-sm font-semibold text-slate-900">Part Verification (Required for Legal Documentation)</p>
              </div>
              <div>
                <FieldBenefitInfo field="verification_source">
                  <Label htmlFor="verification_source" className="font-semibold">Verification Source *</Label>
                </FieldBenefitInfo>
                <p className="text-xs text-slate-600 mb-2">
                  📚 Where you verified this part specification (protects you from warranty disputes)
                </p>
                <Input 
                  id="verification_source" 
                  name="verification_source"
                  defaultValue={editingPart?.verification_source}
                  placeholder="e.g., Caterpillar SIS, John Deere Parts Catalog, OEM Manual"
                  required
                />
              </div>
              <div>
                <Label htmlFor="verification_details" className="font-semibold">Verification Details *</Label>
                <p className="text-xs text-slate-600 mb-2">
                  📖 Specific reference (page, section, link) - makes verification traceable
                </p>
                <Textarea 
                  id="verification_details" 
                  name="verification_details"
                  defaultValue={editingPart?.verification_details}
                  placeholder="e.g., Page 47, Section 5.2, Part Diagram A-42, or https://parts.cat.com/..."
                  rows={2}
                  required
                />
              </div>
              <div>
                <Label htmlFor="verification_photo">Verification Photo/Screenshot (Optional)</Label>
                <p className="text-xs text-slate-600 mb-2">
                  📸 Upload photo of parts book or manual page showing specification
                </p>
                <Input 
                  id="verification_photo"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      try {
                        const result = await base44.integrations.Core.UploadFile({ file });
                        setEditingPart({...editingPart, verification_photo_url: result.file_url});
                        toast.success('Verification photo uploaded');
                      } catch (error) {
                        toast.error('Upload failed');
                      }
                    }
                  }}
                />
                {editingPart?.verification_photo_url && (
                  <div className="mt-2">
                    <img 
                      src={editingPart.verification_photo_url} 
                      alt="Verification" 
                      className="max-w-xs rounded border"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  const formData = new FormData(document.querySelector('form'));
                  const partData = {
                    part_number: formData.get('part_number'),
                    part_description: formData.get('part_description'),
                    supplier: formData.get('supplier'),
                    unit_cost: parseFloat(formData.get('unit_cost')) || 0
                  };
                  if (partData.part_description) {
                    handleSaveToCatalog(partData);
                  } else {
                    toast.error('Enter part description first');
                  }
                }}
                className={catalogSaved ? "text-green-600 border-green-600" : "text-blue-600"}
                disabled={catalogSaved}
              >
                {catalogSaved ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Saved to Catalog
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Save to Catalog
                  </>
                )}
              </Button>
              <div className="flex gap-3">
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
              k: parseFloat(formData.get('k')),
              inflection: parseFloat(formData.get('inflection')),
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
                <strong>Sigmoid Formula:</strong> markup = max + (min - max) / (1 + e<sup>(-k(cost - inflection))</sup>)
              </p>
              <p className="text-xs text-slate-500">
                Smooth S-curve transition: cheap parts get higher markup, expensive parts get lower markup.
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="k">Steepness (k)</Label>
                <Input 
                  id="k" 
                  name="k" 
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="0.1"
                  value={markupSettings.k}
                  onChange={(e) => setMarkupSettings({...markupSettings, k: parseFloat(e.target.value) || 0.01})}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Higher = sharper transition (try 0.005-0.02)
                </p>
              </div>

              <div>
                <Label htmlFor="inflection">Inflection Point ($)</Label>
                <Input 
                  id="inflection" 
                  name="inflection" 
                  type="number"
                  step="10"
                  min="50"
                  max="1000"
                  value={markupSettings.inflection}
                  onChange={(e) => setMarkupSettings({...markupSettings, inflection: parseFloat(e.target.value) || 200})}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Cost where markup is halfway between min/max
                </p>
              </div>
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
                      k: markupSettings.k,
                      inflection: markupSettings.inflection
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Part Order?</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-medium text-slate-900">{deleteConfirm.part_description}</p>
                <div className="text-sm text-slate-600 mt-2 space-y-1">
                  {deleteConfirm.part_number && (
                    <p>Part #: {deleteConfirm.part_number}</p>
                  )}
                  {deleteConfirm.supplier && (
                    <p>Supplier: {deleteConfirm.supplier}</p>
                  )}
                  <p>Quantity: {deleteConfirm.quantity}</p>
                  <p>Cost: ${calculateTotal(deleteConfirm).toFixed(2)}</p>
                  <p className="capitalize">Status: {deleteConfirm.status}</p>
                </div>
              </div>
              
              {deleteConfirm.status === 'received' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ This part is marked as received. Deleting it will not update inventory.
                  </p>
                </div>
              )}
              
              {deleteConfirm.service_report_id && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    This part is linked to a service report. Consider updating the status instead of deleting.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
              >
                Delete Part Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </>
  );
}