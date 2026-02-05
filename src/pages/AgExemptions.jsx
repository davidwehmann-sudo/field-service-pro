import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  FileCheck,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';

export default function AgExemptions() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [editingExemption, setEditingExemption] = useState(null);
  const [exemptionToDelete, setExemptionToDelete] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
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

  const { data: exemptions = [], isLoading } = useQuery({
    queryKey: ['agExemptions'],
    queryFn: () => base44.entities.AgExemption.list('-created_date')
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AgExemption.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agExemptions'] });
      setShowForm(false);
      setEditingExemption(null);
      toast.success('Ag exemption created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AgExemption.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agExemptions'] });
      setShowForm(false);
      setEditingExemption(null);
      toast.success('Ag exemption updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AgExemption.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agExemptions'] });
      setExemptionToDelete(null);
      toast.success('Ag exemption deleted');
    }
  });

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown Customer';
  };

  const filteredExemptions = exemptions.filter(ex => {
    const query = search.toLowerCase();
    const customerName = getCustomerName(ex.customer_id).toLowerCase();
    const matchesSearch = customerName.includes(query) || ex.certificate_number?.toLowerCase().includes(query);
    
    // Auto-check if expired
    const isExpired = ex.expiration_date && isPast(new Date(ex.expiration_date));
    const actualStatus = isExpired ? 'expired' : ex.status;
    
    const matchesStatus = statusFilter === 'all' || actualStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const certificateInput = e.target.querySelector('#certificate_url');
    const certificateUrl = certificateInput?.getAttribute('data-url') || editingExemption?.certificate_url || '';
    
    const data = {
      customer_id: formData.get('customer_id'),
      certificate_number: formData.get('certificate_number'),
      issue_date: formData.get('issue_date'),
      expiration_date: formData.get('expiration_date'),
      status: formData.get('status'),
      certificate_url: certificateUrl,
      notes: formData.get('notes')
    };
    
    if (editingExemption?.id) {
      updateMutation.mutate({ id: editingExemption.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getExemptionStatus = (exemption) => {
    if (exemption.status === 'revoked') return 'revoked';
    if (exemption.expiration_date && isPast(new Date(exemption.expiration_date))) return 'expired';
    return 'active';
  };

  const statusColors = {
    active: "bg-green-100 text-green-700",
    expired: "bg-red-100 text-red-700",
    revoked: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agricultural Exemptions</h1>
          <p className="text-slate-500 mt-1">Track ag exemption certificates and expiration dates</p>
        </div>
        <Button 
          onClick={() => { setEditingExemption(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Exemption
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search by customer or certificate..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Exemptions List */}
      {filteredExemptions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileCheck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search || statusFilter !== 'active' ? 'No exemptions found' : 'No ag exemptions yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredExemptions.map((exemption) => {
            const status = getExemptionStatus(exemption);
            const daysUntilExpiry = exemption.expiration_date 
              ? Math.ceil((new Date(exemption.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))
              : null;
            const expiringsoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

            return (
              <Card 
                key={exemption.id}
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setEditingExemption(exemption); setShowForm(true); }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status === 'active' ? 'bg-green-100' : 
                      status === 'expired' ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      <FileCheck className={`w-6 h-6 ${
                        status === 'active' ? 'text-green-600' : 
                        status === 'expired' ? 'text-red-600' : 'text-slate-600'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {getCustomerName(exemption.customer_id)}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span>Cert: {exemption.certificate_number}</span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Expires: {format(new Date(exemption.expiration_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {expiringsoon && status === 'active' && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-yellow-700">
                              <AlertTriangle className="w-3 h-3" />
                              Expires in {daysUntilExpiry} days
                            </div>
                          )}
                        </div>
                        
                        <Badge className={statusColors[status]}>
                          {status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {exemption.certificate_url && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(exemption.certificate_url, '_blank')}
                          title="View certificate"
                        >
                          <FileCheck className="w-4 h-4 text-blue-500" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setExemptionToDelete(exemption)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Exemption Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingExemption?.id ? 'Edit Ag Exemption' : 'Add Ag Exemption'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Select name="customer_id" defaultValue={editingExemption?.customer_id || ''} required>
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

            <div>
              <Label htmlFor="certificate_number">Certificate Number *</Label>
              <Input 
                id="certificate_number" 
                name="certificate_number" 
                required
                defaultValue={editingExemption?.certificate_number}
                placeholder="AG-12345"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input 
                  id="issue_date" 
                  name="issue_date" 
                  type="date"
                  defaultValue={editingExemption?.issue_date}
                />
              </div>
              <div>
                <Label htmlFor="expiration_date">Expiration Date *</Label>
                <Input 
                  id="expiration_date" 
                  name="expiration_date" 
                  type="date"
                  required
                  defaultValue={editingExemption?.expiration_date}
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={editingExemption?.status || 'active'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="certificate_url">Certificate Upload</Label>
              <Input 
                id="certificate_url" 
                name="certificate_url" 
                type="file"
                accept="image/*,.pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      e.target.setAttribute('data-url', file_url);
                      toast.success('Certificate uploaded');
                    } catch (error) {
                      toast.error('Failed to upload certificate');
                    }
                  }
                }}
              />
              {editingExemption?.certificate_url && (
                <a 
                  href={editingExemption.certificate_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                >
                  View current certificate
                </a>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes"
                defaultValue={editingExemption?.notes}
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
                {editingExemption?.id ? 'Save Changes' : 'Add Exemption'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={!!exemptionToDelete}
        onOpenChange={(open) => !open && setExemptionToDelete(null)}
        title="Delete Ag Exemption?"
        description="This exemption record will be permanently deleted."
        details={exemptionToDelete && `Customer: ${getCustomerName(exemptionToDelete.customer_id)} • Cert: ${exemptionToDelete.certificate_number}`}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (exemptionToDelete) {
            deleteMutation.mutate(exemptionToDelete.id);
          }
        }}
      />
    </div>
  );
}