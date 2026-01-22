import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Truck, Pencil, Trash2, DollarSign, FileText, Fuel, Download } from "lucide-react";
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function VehicleExpenses() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ownVehicles'],
    queryFn: () => base44.entities.OwnVehicle.list()
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        if (!['service_admin', 'service_technician', 'bookkeeper', 'software_engineer'].includes(user.user_type)) {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['vehicleExpenses'],
    queryFn: () => base44.entities.VehicleExpense.list('-expense_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VehicleExpense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleExpenses'] });
      setShowForm(false);
      setEditingExpense(null);
      toast.success('Expense recorded');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.VehicleExpense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleExpenses'] });
      setShowForm(false);
      setEditingExpense(null);
      toast.success('Expense updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VehicleExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicleExpenses'] });
      toast.success('Expense deleted');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const receiptInput = e.target.querySelector('#receipt_url');
    const receiptUrl = receiptInput?.getAttribute('data-url') || editingExpense?.receipt_url || '';
    
    const vehicleName = formData.get('vehicle_name');
    const vehicle = vehicles.find(v => v.name === vehicleName);

    const data = {
      expense_date: formData.get('expense_date'),
      vehicle_name: vehicleName,
      own_vehicle_id: vehicle?.id || null,
      expense_type: formData.get('expense_type'),
      description: formData.get('description'),
      vendor: formData.get('vendor'),
      amount: parseFloat(formData.get('amount')) || 0,
      odometer: formData.get('odometer') ? parseFloat(formData.get('odometer')) : null,
      receipt_url: receiptUrl,
      paid_by: formData.get('paid_by') || 'company',
      notes: formData.get('notes')
    };
    
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const uniqueVehicles = [...new Set(expenses.map(e => e.vehicle_name))].sort();

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      e.vehicle_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || e.expense_type === typeFilter;
    const matchesVehicle = vehicleFilter === 'all' || e.vehicle_name === vehicleFilter;
    
    const matchesDateRange = (!startDate || !endDate) || (
      e.expense_date && 
      new Date(e.expense_date) >= new Date(startDate) && 
      new Date(e.expense_date) <= new Date(endDate)
    );
    
    return matchesSearch && matchesType && matchesVehicle && matchesDateRange;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const expenseTypeColors = {
    fuel: "bg-orange-100 text-orange-700",
    maintenance: "bg-blue-100 text-blue-700",
    repair: "bg-red-100 text-red-700",
    upgrade: "bg-purple-100 text-purple-700",
    insurance: "bg-green-100 text-green-700",
    registration: "bg-slate-100 text-slate-700",
    other: "bg-gray-100 text-gray-700"
  };

  const getVehicleOwnership = (vehicleName) => {
    const vehicle = vehicles.find(v => v.name === vehicleName);
    return vehicle?.vehicle_owner || 'company';
  };

  const downloadCSV = () => {
    const csvContent = [
      ['Date', 'Vehicle', 'Type', 'Description', 'Vendor', 'Amount', 'Paid By', 'Odometer', 'Notes'].join(','),
      ...filteredExpenses.map(e => [
        e.expense_date || '',
        e.vehicle_name || '',
        e.expense_type || '',
        (e.description || '').replace(/,/g, ' '),
        (e.vendor || '').replace(/,/g, ' '),
        e.amount?.toFixed(2) || '0.00',
        e.paid_by || 'company',
        e.odometer || '',
        (e.notes || '').replace(/,/g, ' ').replace(/\n/g, ' ')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Expenses exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vehicle Expenses</h1>
          <p className="text-slate-500 mt-1">Track fuel, maintenance, and repairs</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={downloadCSV}
            variant="outline"
            disabled={filteredExpenses.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            onClick={() => { setEditingExpense(null); setShowForm(true); }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm mb-1">Total Expenses</p>
              <p className="text-3xl font-bold">${totalExpenses.toFixed(2)}</p>
              <p className="text-slate-300 text-sm mt-1">{filteredExpenses.length} transactions</p>
            </div>
            <Truck className="w-16 h-16 text-slate-600 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {uniqueVehicles.map(vehicle => (
                  <SelectItem key={vehicle} value={vehicle}>{vehicle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Expense Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="fuel">Fuel</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="upgrade">Upgrade</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="other">Other</SelectItem>
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

        {(vehicleFilter !== 'all' || typeFilter !== 'all' || startDate || endDate) && (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setVehicleFilter('all');
                setTypeFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </Button>
            <span className="text-sm text-slate-500">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'} • ${totalExpenses.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Expenses List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">No expenses recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <Card key={expense.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    {expense.expense_type === 'fuel' ? (
                      <Fuel className="w-6 h-6 text-orange-600" />
                    ) : (
                      <Truck className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">
                            {expense.vehicle_name}
                          </h3>
                          <Badge className={expenseTypeColors[expense.expense_type]}>
                            {expense.expense_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{expense.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          <span>{format(new Date(expense.expense_date), 'MMM d, yyyy')}</span>
                          {expense.vendor && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{expense.vendor}</span>
                            </>
                          )}
                          {expense.odometer && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{expense.odometer.toLocaleString()} mi</span>
                            </>
                          )}
                          {getVehicleOwnership(expense.vehicle_name) === 'personal' && expense.paid_by && (
                            <>
                              <span className="text-slate-300">•</span>
                              <Badge className={expense.paid_by === 'company' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                                {expense.paid_by === 'company' ? 'Company Paid' : 'Owner Paid'}
                              </Badge>
                            </>
                          )}
                          {expense.receipt_url && (
                            <>
                              <span className="text-slate-300">•</span>
                              <a 
                                href={expense.receipt_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                Receipt
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">
                          ${(expense.amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setEditingExpense(expense); setShowForm(true); }}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteMutation.mutate(expense.id)}
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

      {/* Expense Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Edit Expense' : 'Add Vehicle Expense'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expense_date">Date *</Label>
                <Input 
                  id="expense_date" 
                  name="expense_date" 
                  type="date"
                  required
                  defaultValue={editingExpense?.expense_date || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div>
                <Label htmlFor="vehicle_name">Vehicle *</Label>
                <Select name="vehicle_name" defaultValue={editingExpense?.vehicle_name || ''} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.name}>
                        {vehicle.name} {vehicle.vehicle_owner === 'personal' ? '(Personal)' : '(Company)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Expense Type *</Label>
              <Select name="expense_type" defaultValue={editingExpense?.expense_type || 'fuel'} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="registration">Registration</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Input 
                id="description" 
                name="description"
                required
                defaultValue={editingExpense?.description}
                placeholder="Oil change, fuel fill-up, tire replacement, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vendor">Vendor</Label>
                <Input 
                  id="vendor" 
                  name="vendor"
                  defaultValue={editingExpense?.vendor}
                  placeholder="Shell, Jiffy Lube, etc."
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount ($) *</Label>
                <Input 
                  id="amount" 
                  name="amount"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editingExpense?.amount}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="odometer">Odometer Reading</Label>
              <Input 
                id="odometer" 
                name="odometer"
                type="number"
                defaultValue={editingExpense?.odometer}
                placeholder="Miles"
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
                      toast.success('Receipt uploaded');
                    } catch (error) {
                      toast.error('Failed to upload receipt');
                    }
                  }
                }}
              />
              {editingExpense?.receipt_url && (
                <a 
                  href={editingExpense.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  View current receipt
                </a>
              )}
            </div>

            {getVehicleOwnership(editingExpense?.vehicle_name || '') === 'personal' && (
              <div>
                <Label htmlFor="paid_by">Who Paid? *</Label>
                <Select name="paid_by" defaultValue={editingExpense?.paid_by || 'company'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Wehmann Paid</SelectItem>
                    <SelectItem value="owner">Owner Paid</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">This is a personally-owned vehicle</p>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes"
                defaultValue={editingExpense?.notes}
                placeholder="Additional details..."
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
                {editingExpense ? 'Save Changes' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}