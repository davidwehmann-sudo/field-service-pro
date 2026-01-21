import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  Hash
} from "lucide-react";
import PartsAvailabilityChecker from '@/components/parts/PartsAvailabilityChecker';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import CustomerSelect from '@/components/customers/CustomerSelect';

export default function PartsOrders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const queryClient = useQueryClient();

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

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'N/A';
  };

  const filteredParts = parts.filter(p => {
    const matchesSearch = 
      p.part_description?.toLowerCase().includes(search.toLowerCase()) ||
      p.part_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      ...Object.fromEntries(formData),
      quantity: parseFloat(formData.get('quantity')) || 1,
      unit_cost: parseFloat(formData.get('unit_cost')) || 0,
      markup_percent: parseFloat(formData.get('markup_percent')) || 25
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
    const cost = (part.unit_cost || 0) * (part.quantity || 1);
    const markup = cost * ((part.markup_percent || 0) / 100);
    return cost + markup;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Orders</h1>
          <p className="text-slate-500 mt-1">Track parts and orders</p>
        </div>
        <Button 
          onClick={() => { setEditingPart(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Part
        </Button>
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
            <Card key={part.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-purple-600" />
                  </div>
                  
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
                />
              </div>
              <div>
                <Label htmlFor="markup_percent">Markup (%)</Label>
                <Input 
                  id="markup_percent" 
                  name="markup_percent" 
                  type="number"
                  defaultValue={editingPart?.markup_percent || 25}
                />
              </div>
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
    </div>
  );
}