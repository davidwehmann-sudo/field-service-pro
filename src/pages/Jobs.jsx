import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, Search, ClipboardCheck, FileText, Package, ChevronRight, Calendar, DollarSign, Building2, Trash2 } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  authorized: "bg-green-100 text-green-700",
  service_started: "bg-blue-100 text-blue-700",
  completed: "bg-purple-100 text-purple-700",
  invoiced: "bg-slate-100 text-slate-500",
  needed: "bg-amber-100 text-amber-700",
  ordered: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  installed: "bg-slate-100 text-slate-500"
};

export default function Jobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        if (user.user_type === 'service_customer') {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const { data: authorizations = [] } = useQuery({
    queryKey: ['authorizations'],
    queryFn: () => base44.entities.PreRepairAuthorization.list('-created_date'),
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date'),
  });

  const { data: partsOrders = [] } = useQuery({
    queryKey: ['parts-orders'],
    queryFn: () => base44.entities.PartsOrder.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: jobsData = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId) => {
      const job = jobsData.find(j => j.id === jobId);
      if (!job) return;
      
      // Delete all related entities first
      if (deleteModal?.authorization?.id) {
        await base44.entities.PreRepairAuthorization.delete(deleteModal.authorization.id);
      }
      if (deleteModal?.serviceReport?.id) {
        await base44.entities.ServiceReport.delete(deleteModal.serviceReport.id);
      }
      if (deleteModal?.partsOrders?.length) {
        for (const po of deleteModal.partsOrders) {
          await base44.entities.PartsOrder.delete(po.id);
        }
      }
      
      // Delete the job itself
      if (job.id && !job.id.startsWith('temp-')) {
        await base44.entities.Job.delete(jobId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', 'authorizations', 'service-reports', 'parts-orders'] });
      setDeleteModal(null);
    }
  });

  // Build unified job view
  const jobs = React.useMemo(() => {
    const jobsMap = new Map();

    // Start with Job entities
    jobsData.forEach(job => {
      jobsMap.set(job.id, {
        ...job,
        jobNumber: job.job_number,
        type: job.job_type || 'service',
        date: job.created_date,
        authorization: null,
        serviceReport: null,
        partsOrders: []
      });
    });

    // Link authorizations
    authorizations.forEach(auth => {
      if (auth.job_id && jobsMap.has(auth.job_id)) {
        jobsMap.get(auth.job_id).authorization = auth;
      } else if (!auth.job_id) {
        // Orphaned authorization - no job yet
        const tempId = `temp-auth-${auth.id}`;
        jobsMap.set(tempId, {
          id: tempId,
          jobNumber: null,
          customer_id: auth.customer_id,
          type: 'service',
          date: auth.authorization_date || auth.created_date,
          authorization: auth,
          serviceReport: null,
          partsOrders: []
        });
      }
    });

    // Link service reports
    serviceReports.forEach(sr => {
      if (sr.job_id && jobsMap.has(sr.job_id)) {
        jobsMap.get(sr.job_id).serviceReport = sr;
      } else if (!sr.job_id) {
        // Orphaned service report
        const tempId = `temp-sr-${sr.id}`;
        jobsMap.set(tempId, {
          id: tempId,
          jobNumber: null,
          customer_id: sr.customer_id,
          type: 'service',
          date: sr.service_date,
          authorization: null,
          serviceReport: sr,
          partsOrders: []
        });
      }
    });

    // Link parts orders
    partsOrders.forEach(po => {
      if (po.job_id && jobsMap.has(po.job_id)) {
        jobsMap.get(po.job_id).partsOrders.push(po);
      } else if (!po.job_id) {
        // Orphaned parts order
        const tempId = `temp-po-${po.id}`;
        const existing = Array.from(jobsMap.values()).find(
          j => j.id.startsWith('temp-po-') && j.customer_id === po.customer_id
        );
        
        if (existing) {
          existing.partsOrders.push(po);
        } else {
          jobsMap.set(tempId, {
            id: tempId,
            jobNumber: null,
            customer_id: po.customer_id,
            type: 'parts_only',
            date: po.order_date || po.created_date,
            authorization: null,
            serviceReport: null,
            partsOrders: [po]
          });
        }
      }
    });

    return Array.from(jobsMap.values()).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
  }, [jobsData, authorizations, serviceReports, partsOrders]);

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  };

  const filteredJobs = jobs.filter(job => {
    const customerName = getCustomerName(job.customer_id).toLowerCase();
    const query = searchQuery.toLowerCase();
    const srMatch = job.serviceReport?.equipment_type?.toLowerCase().includes(query) ||
                    job.serviceReport?.complaint?.toLowerCase().includes(query);
    const authMatch = job.authorization?.nature_of_service?.toLowerCase().includes(query);
    const partsMatch = job.partsOrders.some(po => 
      po.part_description?.toLowerCase().includes(query)
    );
    
    return customerName.includes(query) || srMatch || authMatch || partsMatch;
  });

  const getJobStatus = (job) => {
    if (job.serviceReport) {
      return job.serviceReport.status;
    }
    if (job.authorization) {
      return job.authorization.status;
    }
    return 'draft';
  };

  const getJobTitle = (job) => {
    if (job.serviceReport) {
      return `${job.serviceReport.equipment_type} - ${job.serviceReport.equipment_make || ''}`.trim();
    }
    if (job.authorization) {
      return job.authorization.nature_of_service?.slice(0, 60) || 'Authorization';
    }
    return 'Parts Only';
  };

  const getJobValue = (job) => {
    let total = 0;
    
    if (job.serviceReport?.service_items) {
      total += job.serviceReport.service_items.reduce((sum, item) => sum + (item.total || 0), 0);
    }
    
    if (job.serviceReport?.destination_fee?.total) {
      total += job.serviceReport.destination_fee.total;
    }
    
    job.partsOrders.forEach(po => {
      const partCost = (po.unit_cost || 0) * (po.quantity || 0);
      const markup = partCost * ((po.markup_percent || 0) / 100);
      total += partCost + markup;
    });
    
    return total;
  };

  const isJobActive = (status) => {
    return ['authorized', 'service_started', 'in_progress'].includes(status);
  };

  const handleDeleteClick = (job) => {
    const status = getJobStatus(job);
    setDeleteModal({
      job,
      status,
      authorization: job.authorization,
      serviceReport: job.serviceReport,
      partsOrders: job.partsOrders
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Jobs Overview</h1>
          <p className="text-slate-500">Unified view of authorizations, service work, and parts</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by customer, equipment, or parts..."
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {filteredJobs.map((job) => (
          <Card key={job.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {job.type === 'service_report' ? (
                    <FileText className="w-6 h-6 text-amber-600" />
                  ) : job.type === 'authorization' ? (
                    <ClipboardCheck className="w-6 h-6 text-amber-600" />
                  ) : (
                    <Package className="w-6 h-6 text-amber-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {job.jobNumber ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {job.jobNumber}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                            No Job #
                          </Badge>
                        )}
                        <h3 className="font-semibold text-slate-900">
                          {getCustomerName(job.customer_id)}
                        </h3>
                        <Badge className={statusColors[getJobStatus(job)]}>
                          {getJobStatus(job).replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700 mb-2">
                        {getJobTitle(job)}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        ${getJobValue(job).toFixed(2)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(job.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mb-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(job)}
                      className="text-red-400 hover:text-red-600"
                      title="Delete job and all related items"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    {/* Authorization */}
                    <div className={`p-3 rounded-lg border ${job.authorization ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className={`w-4 h-4 ${job.authorization ? 'text-green-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Authorization</span>
                      </div>
                      {job.authorization ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.authorization.service_type?.replace(/_/g, ' ')}
                          </p>
                          <Link 
                            to={createPageUrl('Authorizations')}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Details <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ) : (
                        <Link 
                          to={createPageUrl('Authorizations')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Create Authorization <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    {/* Service Report */}
                    <div className={`p-3 rounded-lg border ${job.serviceReport ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className={`w-4 h-4 ${job.serviceReport ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Service Report</span>
                      </div>
                      {job.serviceReport ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.serviceReport.equipment_type}
                          </p>
                          <Link 
                            to={createPageUrl('ServiceReports')}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Details <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ) : (
                        <Link 
                          to={createPageUrl('FieldTech')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Create Service Report <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    {/* Parts Orders */}
                    <div className={`p-3 rounded-lg border ${job.partsOrders.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Package className={`w-4 h-4 ${job.partsOrders.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Parts Orders</span>
                      </div>
                      {job.partsOrders.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.partsOrders.length} {job.partsOrders.length === 1 ? 'part' : 'parts'}
                          </p>
                          <Link 
                            to={createPageUrl('PartsOrders')}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View Details <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ) : (
                        <Link 
                          to={createPageUrl('PartsOrders')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Add Parts <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredJobs.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">
                {searchQuery ? 'No jobs found' : 'No jobs yet'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteModal} onOpenChange={(open) => !open && setDeleteModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isJobActive(deleteModal?.status) && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              Delete Job?
            </DialogTitle>
            <DialogDescription>
              {isJobActive(deleteModal?.status) 
                ? "⚠️ This job is currently active. Deleting it will remove all related authorization, service report, and parts records."
                : "This will permanently delete this job and all its related records:"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-slate-600">
            {deleteModal?.authorization && (
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-600" />
                <span>Pre-Repair Authorization ({deleteModal.authorization.status})</span>
              </div>
            )}
            {deleteModal?.serviceReport && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Service Report ({deleteModal.serviceReport.status})</span>
              </div>
            )}
            {deleteModal?.partsOrders?.length > 0 && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span>{deleteModal.partsOrders.length} Parts Order{deleteModal.partsOrders.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteJobMutation.mutate(deleteModal.job.id)}
              disabled={deleteJobMutation.isPending}
            >
              {deleteJobMutation.isPending ? 'Deleting...' : 'Delete Job'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}