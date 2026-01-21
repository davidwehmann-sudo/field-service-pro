import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Building2, Calendar, DollarSign, Pencil, Trash2, Mail } from "lucide-react";
import { format } from 'date-fns';
import AuthorizationForm from '@/components/authorization/AuthorizationForm';
import { toast } from "sonner";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  authorized: "bg-green-100 text-green-700",
  service_started: "bg-blue-100 text-blue-700",
  completed: "bg-slate-100 text-slate-500"
};

const serviceTypeLabels = {
  check_and_advise: "Check & Advise",
  consultation: "Consultation",
  diagnostic: "Diagnostic",
  repair: "Repair",
  preventive_maintenance: "PM Service",
  emergency_service: "Emergency"
};

export default function Authorizations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAuth, setEditingAuth] = useState(null);
  const [sendingEmailFor, setSendingEmailFor] = useState(null);

  const queryClient = useQueryClient();

  const { data: authorizations = [], isLoading: authLoading } = useQuery({
    queryKey: ['authorizations'],
    queryFn: () => base44.entities.PreRepairAuthorization.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PreRepairAuthorization.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['authorizations']);
      setShowForm(false);
      setEditingAuth(null);
      toast.success("Authorization created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PreRepairAuthorization.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['authorizations']);
      setShowForm(false);
      setEditingAuth(null);
      toast.success("Authorization updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PreRepairAuthorization.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['authorizations']);
      toast.success("Authorization deleted");
    },
  });

  const handleSave = (data) => {
    if (editingAuth?.id) {
      updateMutation.mutate({ id: editingAuth.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (auth) => {
    setEditingAuth(auth);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this authorization?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSendCopy = async (auth) => {
    if (!auth.billing_contact_email) {
      toast.error("No email address on file");
      return;
    }

    setSendingEmailFor(auth.id);
    try {
      const serviceTypeLabel = serviceTypeLabels[auth.service_type] || auth.service_type;
      const customer = customers.find(c => c.id === auth.customer_id);
      
      await base44.integrations.Core.SendEmail({
        to: auth.billing_contact_email,
        subject: `Pre-Repair Authorization - ${customer?.company_name || 'Service'}`,
        body: `
Dear ${auth.billing_contact_name},

This is a copy of your pre-repair authorization for your records.

AUTHORIZATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customer: ${customer?.company_name || 'N/A'}
Service Type: ${serviceTypeLabel}
${auth.equipment_info ? `Equipment: ${auth.equipment_info}` : ''}
Authorization Date: ${format(new Date(auth.authorization_date), 'MMMM d, yyyy')}
${auth.estimated_cost ? `Estimated Cost: $${parseFloat(auth.estimated_cost).toFixed(2)}${auth.cost_is_ai_estimate ? ' (AI-generated estimate)' : ''}` : ''}

NATURE OF SERVICE:
${auth.nature_of_service}

BILLING CONTACT:
${auth.billing_contact_name}
${auth.billing_contact_company || ''}
${auth.billing_contact_phone || ''}
${auth.billing_address ? `${auth.billing_address}, ${auth.billing_city}, ${auth.billing_state} ${auth.billing_zip}` : ''}

${auth.on_site_contact_name ? `ON-SITE CONTACT:
${auth.on_site_contact_name}
${auth.on_site_contact_phone || ''}` : ''}

${auth.notes ? `NOTES:
${auth.notes}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This authorization confirms your approval for the service work described above.

If you have any questions, please contact us.

Thank you for your business.
        `
      });

      toast.success(`Sent to ${auth.billing_contact_email}`);
    } catch (error) {
      toast.error("Failed to send email");
    } finally {
      setSendingEmailFor(null);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  };

  const filteredAuths = authorizations.filter(auth => {
    const customerName = getCustomerName(auth.customer_id).toLowerCase();
    const query = searchQuery.toLowerCase();
    return customerName.includes(query) || 
           auth.billing_contact_name?.toLowerCase().includes(query) ||
           auth.nature_of_service?.toLowerCase().includes(query);
  });

  if (showForm) {
    return (
      <AuthorizationForm
        authorization={editingAuth}
        customers={customers}
        onSave={handleSave}
        onAuthorize={handleSave}
        onBack={() => {
          setShowForm(false);
          setEditingAuth(null);
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Pre-Repair Authorizations</h1>
          <p className="text-slate-500">Customer authorization forms for service work</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4 mr-2" />
          New Authorization
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by customer, contact, or description..."
          className="pl-10"
        />
      </div>

      {/* Authorizations List */}
      <div className="grid gap-4">
        {authLoading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : filteredAuths.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">
                {searchQuery ? 'No authorizations found' : 'No authorizations yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAuths.map((auth) => (
            <Card key={auth.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-amber-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">
                            {getCustomerName(auth.customer_id)}
                          </h3>
                          <Badge className={statusColors[auth.status]}>
                            {auth.status.replace(/_/g, ' ')}
                          </Badge>
                          {auth.service_type && (
                            <Badge variant="outline" className="text-xs">
                              {serviceTypeLabels[auth.service_type]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          Authorized by: {auth.billing_contact_name}
                          {auth.billing_contact_company && ` (${auth.billing_contact_company})`}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {auth.status === 'authorized' && auth.billing_contact_email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendCopy(auth)}
                            disabled={sendingEmailFor === auth.id}
                            title="Send copy to customer"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(auth)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(auth.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {auth.nature_of_service && (
                      <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                        {auth.nature_of_service}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      {auth.equipment_info && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {auth.equipment_info}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(auth.authorization_date), 'MMM d, yyyy')}
                      </div>
                      {auth.estimated_cost && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Estimated: ${auth.estimated_cost.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}