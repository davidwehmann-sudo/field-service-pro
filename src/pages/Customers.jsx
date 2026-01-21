import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Pencil, 
  Trash2,
  User,
  Link as LinkIcon
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Block customers
        if (user.user_type === 'customer') {
          navigate(createPageUrl('Home'));
        }
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

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const filteredCustomers = customers.filter(c => 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleGeneratePortalLink = async (customer) => {
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await base44.entities.CustomerAccessToken.create({
        customer_id: customer.id,
        token: token,
        is_active: true
      });
      
      const portalUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/CustomerPortal')}?token=${token}`;
      await navigator.clipboard.writeText(portalUrl);
      
      alert("Portal link copied! Send this link to the customer:\n\n" + portalUrl);
    } catch (error) {
      alert("Failed to generate portal link");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">Manage your customer accounts</p>
        </div>
        <Button 
          onClick={() => { setEditingCustomer(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customer Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search ? 'No customers found' : 'No customers yet'}
            </p>
            {!search && (
              <Button 
                variant="link" 
                className="text-amber-600 mt-2"
                onClick={() => setShowForm(true)}
              >
                Add your first customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{customer.company_name}</h3>
                      {customer.contact_name && (
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {customer.contact_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleGeneratePortalLink(customer)}
                      title="Generate portal link"
                    >
                      <LinkIcon className="w-4 h-4 text-blue-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => handleEdit(customer)}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => deleteMutation.mutate(customer.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-amber-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {customer.phone}
                    </a>
                  )}
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-slate-600 hover:text-amber-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {customer.email}
                    </a>
                  )}
                  {(customer.city || customer.state) && (
                    <p className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {[customer.city, customer.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Customer Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="company_name">Company Name *</Label>
              <Input 
                id="company_name" 
                name="company_name" 
                required
                defaultValue={editingCustomer?.company_name}
                placeholder="ABC Trucking"
              />
            </div>

            <div>
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input 
                id="contact_name" 
                name="contact_name"
                defaultValue={editingCustomer?.contact_name}
                placeholder="John Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  type="tel"
                  defaultValue={editingCustomer?.phone}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email"
                  defaultValue={editingCustomer?.email}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                name="address"
                defaultValue={editingCustomer?.address}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city" 
                  name="city"
                  defaultValue={editingCustomer?.city}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input 
                  id="state" 
                  name="state"
                  defaultValue={editingCustomer?.state}
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input 
                  id="zip" 
                  name="zip"
                  defaultValue={editingCustomer?.zip}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                name="notes"
                defaultValue={editingCustomer?.notes}
                placeholder="Special instructions, fleet info, etc."
                rows={3}
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
                {editingCustomer ? 'Save Changes' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}