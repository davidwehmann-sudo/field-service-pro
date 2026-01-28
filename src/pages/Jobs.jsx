import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, Search, ClipboardCheck, FileText, Package, ChevronRight, Calendar, DollarSign, Building2, Trash2, Plus, GripVertical } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from "sonner";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-slate-100 text-slate-700",
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
  const [selectedItems, setSelectedItems] = useState([]);
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

  const createEmptyJobMutation = useMutation({
    mutationFn: async (customerId) => {
      const { data: jobNumberData } = await base44.functions.invoke('generateJobNumber');
      return base44.entities.Job.create({
        job_number: jobNumberData.job_number,
        customer_id: customerId,
        job_type: 'service',
        status: 'open'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('New job created');
    }
  });

  const generateJobNumberMutation = useMutation({
    mutationFn: async (jobId) => {
      const { data: jobNumberData } = await base44.functions.invoke('generateJobNumber');
      await base44.entities.Job.update(jobId, { 
        job_number: jobNumberData.job_number 
      });
      return jobNumberData.job_number;
    },
    onSuccess: (jobNumber) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const assignToJobMutation = useMutation({
    mutationFn: async ({ itemType, itemId, jobId }) => {
      if (itemType === 'authorization') {
        await base44.entities.PreRepairAuthorization.update(itemId, { job_id: jobId });
      } else if (itemType === 'serviceReport') {
        await base44.entities.ServiceReport.update(itemId, { job_id: jobId });
      } else if (itemType === 'partsOrder') {
        // Fetch the part fresh from the API to ensure we have all current data
        const freshParts = await base44.entities.PartsOrder.filter({ id: itemId });
        if (freshParts.length > 0) {
          const part = freshParts[0];
          const { id, created_date, updated_date, created_by, ...partData } = part;
          
          // Ensure required fields are present with defaults
          const updateData = {
            assignment_type: partData.assignment_type || 'service_report',
            part_description: partData.part_description || 'Unknown Part',
            quantity: partData.quantity || 1,
            ...partData,
            job_id: jobId
          };
          
          await base44.entities.PartsOrder.update(itemId, updateData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['jobs']);
      queryClient.invalidateQueries(['authorizations']);
      queryClient.invalidateQueries(['service-reports']);
      queryClient.invalidateQueries(['parts-orders']);
      toast.success('Item assigned to job');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign item');
    }
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
      queryClient.invalidateQueries(['jobs']);
      queryClient.invalidateQueries(['authorizations']);
      queryClient.invalidateQueries(['service-reports']);
      queryClient.invalidateQueries(['parts-orders']);
      setDeleteModal(null);
    }
  });

  // Build unified job view (only real jobs, no orphans)
  const jobs = React.useMemo(() => {
    return jobsData.map(job => {
      const auth = authorizations.find(a => a.job_id === job.id);
      const sr = serviceReports.find(s => s.job_id === job.id);
      const parts = partsOrders.filter(p => p.job_id === job.id);
      
      return {
        ...job,
        jobNumber: job.job_number,
        type: job.job_type || 'service',
        date: job.created_date,
        authorization: auth || null,
        serviceReport: sr || null,
        partsOrders: parts
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [jobsData, authorizations, serviceReports, partsOrders]);

  // Separate orphaned items
  const orphanedAuths = useMemo(() => 
    authorizations.filter(a => !a.job_id), 
    [authorizations]
  );
  
  const orphanedReports = useMemo(() => 
    serviceReports.filter(sr => !sr.job_id), 
    [serviceReports]
  );
  
  const orphanedParts = useMemo(() => 
    partsOrders.filter(po => !po.job_id), 
    [partsOrders]
  );

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  }, [customers]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => {
      const customerName = getCustomerName(job.customer_id).toLowerCase();
      const srMatch = job.serviceReport?.equipment_type?.toLowerCase().includes(query) ||
                      job.serviceReport?.complaint?.toLowerCase().includes(query);
      const authMatch = job.authorization?.nature_of_service?.toLowerCase().includes(query);
      const partsMatch = job.partsOrders.some(po => 
        po.part_description?.toLowerCase().includes(query)
      );
      
      return customerName.includes(query) || srMatch || authMatch || partsMatch;
    });
  }, [jobs, searchQuery, getCustomerName]);

  const getJobStatus = (job) => {
    if (job.serviceReport) {
      return job.serviceReport.status;
    }
    if (job.authorization) {
      return job.authorization.status;
    }
    return job.status || 'open';
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

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;
    
    // Parse draggableId: format is "type-id"
    // Handle IDs that may contain dashes
    const firstDashIndex = draggableId.indexOf('-');
    const itemType = draggableId.substring(0, firstDashIndex);
    const itemId = draggableId.substring(firstDashIndex + 1);
    const jobId = destination.droppableId.replace('job-', '');
    
    // Don't do anything if dropped in the same place
    if (source.droppableId === destination.droppableId) return;
    
    // If item is selected, assign all selected items
    const itemKey = `${itemType}-${itemId}`;
    if (selectedItems.includes(itemKey)) {
      // Assign all selected items
      for (const selected of selectedItems) {
        const firstDash = selected.indexOf('-');
        const type = selected.substring(0, firstDash);
        const id = selected.substring(firstDash + 1);
        await assignToJobMutation.mutateAsync({ itemType: type, itemId: id, jobId });
      }
      setSelectedItems([]);
      toast.success(`${selectedItems.length} items assigned to job`);
    } else {
      assignToJobMutation.mutate({ itemType, itemId, jobId });
    }
  };

  const handleCreateEmptyJob = async () => {
    if (customers.length === 0) {
      toast.error('Please create a customer first');
      return;
    }
    
    // Use first customer or prompt for selection
    const customerId = customers[0].id;
    createEmptyJobMutation.mutate(customerId);
  };

  const hasOrphans = orphanedAuths.length > 0 || orphanedReports.length > 0 || orphanedParts.length > 0;

  const toggleItemSelection = (itemType, itemId) => {
    const itemKey = `${itemType}-${itemId}`;
    setSelectedItems(prev => 
      prev.includes(itemKey) ? prev.filter(id => id !== itemKey) : [...prev, itemKey]
    );
  };

  const isItemSelected = (itemType, itemId) => {
    return selectedItems.includes(`${itemType}-${itemId}`);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Jobs Overview</h1>
            <p className="text-slate-500">Unified view of authorizations, service work, and parts</p>
          </div>
          <Button 
            onClick={handleCreateEmptyJob}
            className="bg-amber-500 hover:bg-amber-600"
            disabled={createEmptyJobMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Empty Job
          </Button>
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

        {/* Orphaned Items Section */}
        {hasOrphans && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Unassigned Items - Drag to Job
              </h2>
              {selectedItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white">
                    {selectedItems.length} selected
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedItems([])}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">Ctrl+Click to multi-select items</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Orphaned Authorizations */}
              {orphanedAuths.length > 0 && (
                <Droppable droppableId="orphan-auths" isDropDisabled={true}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      <h3 className="text-sm font-medium text-slate-600 mb-2">Authorizations ({orphanedAuths.length})</h3>
                      {orphanedAuths.map((auth, index) => (
                        <Draggable key={auth.id} draggableId={`authorization-${auth.id}`} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-all ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-amber-400' : 
                                isItemSelected('authorization', auth.id) ? 'ring-2 ring-amber-400 bg-amber-50' : 
                                'border-slate-200'
                              }`}
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  toggleItemSelection('authorization', auth.id);
                                }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {getCustomerName(auth.customer_id)}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {auth.service_type?.replace(/_/g, ' ')}
                                  </p>
                                </div>
                                <ClipboardCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}

              {/* Orphaned Service Reports */}
              {orphanedReports.length > 0 && (
                <Droppable droppableId="orphan-reports" isDropDisabled={true}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      <h3 className="text-sm font-medium text-slate-600 mb-2">Service Reports ({orphanedReports.length})</h3>
                      {orphanedReports.map((sr, index) => (
                        <Draggable key={sr.id} draggableId={`serviceReport-${sr.id}`} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-all ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 
                                isItemSelected('serviceReport', sr.id) ? 'ring-2 ring-blue-400 bg-blue-50' : 
                                'border-slate-200'
                              }`}
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  toggleItemSelection('serviceReport', sr.id);
                                }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {getCustomerName(sr.customer_id)}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {sr.equipment_type}
                                  </p>
                                </div>
                                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}

              {/* Orphaned Parts */}
              {orphanedParts.length > 0 && (
                <Droppable droppableId="orphan-parts" isDropDisabled={true}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      <h3 className="text-sm font-medium text-slate-600 mb-2">Parts Orders ({orphanedParts.length})</h3>
                      {orphanedParts.map((po, index) => (
                        <Draggable key={po.id} draggableId={`partsOrder-${po.id}`} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-all ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-purple-400' : 
                                isItemSelected('partsOrder', po.id) ? 'ring-2 ring-purple-400 bg-purple-50' : 
                                'border-slate-200'
                              }`}
                              onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  toggleItemSelection('partsOrder', po.id);
                                }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {po.part_description}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {po.supplier || 'No supplier'}
                                  </p>
                                </div>
                                <Package className="w-4 h-4 text-purple-600 flex-shrink-0" />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <Droppable key={job.id} droppableId={`job-${job.id}`}>
              {(provided, snapshot) => (
                <Card 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`hover:shadow-md transition-all ${snapshot.isDraggingOver ? 'ring-2 ring-amber-400 bg-amber-50' : ''}`}
                >
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
                        ) : job.id && !job.id.startsWith('temp-') ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateJobNumberMutation.mutate(job.id);
                            }}
                            disabled={generateJobNumberMutation.isPending}
                          >
                            {generateJobNumberMutation.isPending ? 'Generating...' : 'Generate Job #'}
                          </Button>
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
                    <Link 
                      to={job.authorization ? `${createPageUrl('Authorizations')}?edit=${job.authorization.id}` : createPageUrl('Authorizations')}
                      className={`p-3 rounded-lg border transition-all hover:shadow-md ${job.authorization ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className={`w-4 h-4 ${job.authorization ? 'text-green-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Authorization</span>
                      </div>
                      {job.authorization ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.authorization.service_type?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            Click to edit <ChevronRight className="w-3 h-3" />
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          Create Authorization <ChevronRight className="w-3 h-3" />
                        </p>
                      )}
                    </Link>

                    {/* Service Report */}
                    <Link 
                      to={job.serviceReport ? `${createPageUrl('ServiceReports')}?edit=${job.serviceReport.id}` : createPageUrl('FieldTech')}
                      className={`p-3 rounded-lg border transition-all hover:shadow-md ${job.serviceReport ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className={`w-4 h-4 ${job.serviceReport ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Service Report</span>
                      </div>
                      {job.serviceReport ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.serviceReport.equipment_type}
                          </p>
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            Click to edit <ChevronRight className="w-3 h-3" />
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          Create Service Report <ChevronRight className="w-3 h-3" />
                        </p>
                      )}
                    </Link>

                    {/* Parts Orders */}
                    <Link 
                      to={job.partsOrders.length > 0 ? `${createPageUrl('PartsOrders')}?edit=${job.partsOrders[0].id}` : createPageUrl('PartsOrders')}
                      className={`p-3 rounded-lg border transition-all hover:shadow-md ${job.partsOrders.length > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package className={`w-4 h-4 ${job.partsOrders.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-medium text-slate-700">Parts Orders</span>
                      </div>
                      {job.partsOrders.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                            {job.partsOrders.length} {job.partsOrders.length === 1 ? 'part' : 'parts'}
                          </p>
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            Click to edit <ChevronRight className="w-3 h-3" />
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          Add Parts <ChevronRight className="w-3 h-3" />
                        </p>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
                {provided.placeholder}
              </CardContent>
            </Card>
          )}
        </Droppable>
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
    </DragDropContext>
  );
}