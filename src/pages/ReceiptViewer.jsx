import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, FileText, Package, DollarSign, ExternalLink, Edit, AlertTriangle, Trash2, Move, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ReceiptViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteReceiptDialogOpen, setDeleteReceiptDialogOpen] = useState(false);
  const [editedParts, setEditedParts] = useState([]);
  const [availableReceipts, setAvailableReceipts] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: partsOrders = [], isLoading: loadingParts } = useQuery({
    queryKey: ['parts-orders-for-receipts'],
    queryFn: () => base44.entities.PartsOrder.list('-order_date'),
  });

  const { data: vehicleExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['vehicle-expenses-for-receipts'],
    queryFn: () => base44.entities.VehicleExpense.list('-expense_date'),
  });

  const isLoading = loadingParts || loadingExpenses;

  // Group parts and expenses by receipt_url
  const receiptGroups = useMemo(() => {
    const groups = {};
    
    // Add parts orders
    partsOrders.forEach(order => {
      if (order.receipt_url && order.receipt_url.trim()) {
        if (!groups[order.receipt_url]) {
          groups[order.receipt_url] = {
            receipt_url: order.receipt_url,
            parts: [],
            expenses: [],
            totalCost: 0,
            totalShipping: 0,
            supplier: order.supplier,
            order_date: order.order_date,
            type: 'parts'
          };
        }
        groups[order.receipt_url].parts.push(order);
        groups[order.receipt_url].totalCost += (order.unit_cost || 0) * (order.quantity || 1);
        groups[order.receipt_url].totalShipping = Math.max(
          groups[order.receipt_url].totalShipping,
          order.shipping_cost || 0
        );
      }
    });
    
    // Add vehicle expenses
    vehicleExpenses.forEach(expense => {
      if (expense.receipt_url && expense.receipt_url.trim()) {
        if (!groups[expense.receipt_url]) {
          groups[expense.receipt_url] = {
            receipt_url: expense.receipt_url,
            parts: [],
            expenses: [],
            totalCost: 0,
            totalShipping: 0,
            supplier: expense.vendor,
            order_date: expense.expense_date,
            type: 'expense'
          };
        }
        groups[expense.receipt_url].expenses.push(expense);
        groups[expense.receipt_url].totalCost += expense.amount || 0;
        groups[expense.receipt_url].type = 'expense';
        if (!groups[expense.receipt_url].supplier) {
          groups[expense.receipt_url].supplier = expense.vendor;
        }
        if (!groups[expense.receipt_url].order_date) {
          groups[expense.receipt_url].order_date = expense.expense_date;
        }
      }
    });
    
    return Object.values(groups);
  }, [partsOrders, vehicleExpenses]);

  const filteredReceipts = useMemo(() => {
    if (aiResults) {
      return receiptGroups.filter(group =>
        aiResults.receipt_urls?.includes(group.receipt_url)
      );
    }
    if (!searchQuery) return receiptGroups;
    const lower = searchQuery.toLowerCase();
    return receiptGroups.filter(group => 
      group.supplier?.toLowerCase().includes(lower) ||
      group.parts.some(p => 
        p.part_number?.toLowerCase().includes(lower) ||
        p.part_description?.toLowerCase().includes(lower)
      )
    );
  }, [receiptGroups, searchQuery, aiResults]);

  const getReceiptFileName = (url) => {
    try {
      return decodeURIComponent(url.split('/').pop());
    } catch {
      return 'Receipt';
    }
  };

  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');

  const updateMutation = useMutation({
    mutationFn: async ({ updates, deletions }) => {
      // Delete marked parts
      for (const id of deletions) {
        await base44.entities.PartsOrder.delete(id);
      }
      
      // Update remaining parts
      for (const part of updates) {
        await base44.entities.PartsOrder.update(part.id, {
          part_number: part.part_number,
          part_description: part.part_description,
          quantity: parseFloat(part.quantity),
          unit_cost: parseFloat(part.unit_cost),
          shipping_cost: parseFloat(part.shipping_cost || 0),
          receipt_url: part.receipt_url
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-orders-for-receipts']);
      setEditDialogOpen(false);
      setConfirmDialogOpen(false);
      toast.success('Receipt data updated successfully');
    },
    onError: () => {
      toast.error('Failed to update receipt data');
    }
  });

  const handleEditClick = () => {
    if (!selectedReceipt) return;
    setEditedParts(selectedReceipt.parts.map(p => ({
      id: p.id,
      part_number: p.part_number || '',
      part_description: p.part_description || '',
      quantity: p.quantity || 1,
      unit_cost: p.unit_cost || 0,
      shipping_cost: p.shipping_cost || 0,
      receipt_url: p.receipt_url || '',
      _deleted: false
    })));
    setAvailableReceipts(receiptGroups.map(g => g.receipt_url));
    setEditDialogOpen(true);
  };

  const handleDeletePart = (idx) => {
    const updated = [...editedParts];
    updated[idx]._deleted = true;
    setEditedParts(updated);
  };

  const handleRestorePart = (idx) => {
    const updated = [...editedParts];
    updated[idx]._deleted = false;
    setEditedParts(updated);
  };

  const handleSaveClick = () => {
    setEditDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmSave = () => {
    const deletions = editedParts.filter(p => p._deleted).map(p => p.id);
    const updates = editedParts.filter(p => !p._deleted);
    updateMutation.mutate({ updates, deletions });
  };

  const deleteReceiptMutation = useMutation({
    mutationFn: async (receipt_url) => {
      const partsToDelete = partsOrders.filter(p => p.receipt_url === receipt_url);
      for (const part of partsToDelete) {
        await base44.entities.PartsOrder.delete(part.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-orders-for-receipts']);
      setDeleteReceiptDialogOpen(false);
      setSelectedReceipt(null);
      toast.success('Receipt deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete receipt');
    }
  });

  const handleDeleteReceipt = () => {
    setDeleteReceiptDialogOpen(true);
  };

  const handleConfirmDeleteReceipt = () => {
    if (!selectedReceipt) return;
    deleteReceiptMutation.mutate(selectedReceipt.receipt_url);
  };

  const redistributeShippingMutation = useMutation({
    mutationFn: async (receipt_url) => {
      await base44.functions.invoke('distributeShippingCosts', { receipt_url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-orders-for-receipts']);
      toast.success('Shipping costs redistributed');
    },
    onError: () => {
      toast.error('Failed to redistribute shipping costs');
    }
  });

  const handleRedistributeShipping = () => {
    if (!selectedReceipt) return;
    redistributeShippingMutation.mutate(selectedReceipt.receipt_url);
  };

  const handleAISearch = async () => {
    if (!aiSearchQuery.trim()) return;
    
    setAiSearching(true);
    setSearchQuery('');
    
    try {
      const searchContext = receiptGroups.map(group => ({
        receipt_url: group.receipt_url,
        supplier: group.supplier,
        order_date: group.order_date,
        total_cost: group.totalCost,
        parts: group.parts.map(p => ({
          part_number: p.part_number,
          description: p.part_description,
          quantity: p.quantity,
          unit_cost: p.unit_cost
        }))
      }));

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI search assistant for receipt management. Analyze this search query and return relevant receipts.

Query: "${aiSearchQuery}"

Available Receipts:
${JSON.stringify(searchContext, null, 2)}

Return results in this format:
1. interpretation - What the user is looking for
2. receipt_urls - Array of matching receipt URLs
3. reasons - Object mapping receipt_url to reason why it matches

Match based on: supplier name, part numbers, descriptions, dates, costs, or any contextual clues.`,
        response_json_schema: {
          type: "object",
          properties: {
            interpretation: { type: "string" },
            receipt_urls: {
              type: "array",
              items: { type: "string" }
            },
            reasons: {
              type: "object",
              additionalProperties: { type: "string" }
            }
          }
        }
      });

      setAiResults(response);
      if (response.receipt_urls?.length > 0) {
        const firstMatch = receiptGroups.find(g => g.receipt_url === response.receipt_urls[0]);
        if (firstMatch) setSelectedReceipt(firstMatch);
      }
    } catch (err) {
      toast.error('AI search failed. Please try again.');
      console.error(err);
    } finally {
      setAiSearching(false);
    }
  };

  const clearAISearch = () => {
    setAiSearchQuery('');
    setAiResults(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receipt Viewer</h1>
          <p className="text-sm text-slate-500">Review uploaded receipts and extracted data</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {receiptGroups.length} Receipts
        </Badge>
      </div>

      {/* AI Search */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">AI Search</h2>
              <p className="text-xs text-slate-500">Find receipts using natural language</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder='E.g., "hydraulic parts from October" or "receipts over $500"'
              value={aiSearchQuery}
              onChange={(e) => setAiSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAISearch()}
              disabled={aiSearching}
              className="bg-white"
            />
            <Button
              onClick={handleAISearch}
              disabled={aiSearching || !aiSearchQuery.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {aiSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
            {aiResults && (
              <Button variant="outline" onClick={clearAISearch}>
                Clear
              </Button>
            )}
          </div>

          {aiResults && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200">
              <p className="text-sm text-slate-700">
                <strong className="text-purple-700">Found:</strong> {aiResults.interpretation}
              </p>
              {aiResults.receipt_urls?.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {aiResults.receipt_urls.length} receipt{aiResults.receipt_urls.length !== 1 ? 's' : ''} matched
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Standard Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Or search manually by supplier or part..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) clearAISearch();
          }}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipts List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Receipts</h2>
          {filteredReceipts.map((group, idx) => {
            const aiReason = aiResults?.reasons?.[group.receipt_url];
            return (
              <Card 
                key={idx}
                className={`cursor-pointer transition-all ${
                  selectedReceipt === group ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                } ${aiReason ? 'border-purple-300 bg-purple-50/30' : ''}`}
                onClick={() => setSelectedReceipt(group)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {group.supplier || 'Unknown Supplier'}
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">
                        {group.order_date || 'No date'}
                      </p>
                      {aiReason && (
                        <p className="text-xs text-purple-700 mt-2 flex items-start gap-1">
                          <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{aiReason}</span>
                        </p>
                      )}
                    </div>
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">
                        {group.parts.length > 0 && `${group.parts.length} parts`}
                        {group.parts.length > 0 && group.expenses.length > 0 && ' • '}
                        {group.expenses.length > 0 && `${group.expenses.length} expense${group.expenses.length !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">
                        ${group.totalCost.toFixed(2)}
                        {group.totalShipping > 0 && ` + $${group.totalShipping.toFixed(2)} shipping`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredReceipts.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">No receipts found</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Receipt Detail View */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selectedReceipt ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Receipt Document</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditClick}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Correct Data
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRedistributeShipping}
                        disabled={redistributeShippingMutation.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${redistributeShippingMutation.isPending ? 'animate-spin' : ''}`} />
                        Redistribute Shipping
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteReceipt}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Receipt
                      </Button>
                      <a 
                        href={selectedReceipt.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPDF(selectedReceipt.receipt_url) ? (
                    <div className="bg-slate-100 rounded-lg p-8 text-center">
                      <FileText className="w-16 h-16 mx-auto mb-3 text-slate-400" />
                      <p className="text-sm text-slate-600 mb-3">
                        {getReceiptFileName(selectedReceipt.receipt_url)}
                      </p>
                      <a 
                        href={selectedReceipt.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button>Open PDF</Button>
                      </a>
                    </div>
                  ) : (
                    <img 
                      src={selectedReceipt.receipt_url} 
                      alt="Receipt" 
                      className="w-full rounded-lg border border-slate-200"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedReceipt.parts.length > 0 ? 'Extracted Parts' : 'Expense Details'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedReceipt.parts.map((part, idx) => (
                      <div key={`part-${idx}`} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 truncate">
                              {part.part_description}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              PN: {part.part_number}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-slate-900">
                              ${((part.unit_cost || 0) * (part.quantity || 1)).toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Qty: {part.quantity || 1}
                            </p>
                          </div>
                        </div>
                        {part.shipping_cost > 0 && (
                          <p className="text-xs text-blue-600 mt-2">
                            + ${part.shipping_cost.toFixed(2)} shipping
                          </p>
                        )}
                      </div>
                    ))}
                    
                    {selectedReceipt.expenses.map((expense, idx) => (
                      <div key={`expense-${idx}`} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 truncate">
                              {expense.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {expense.vehicle_name} • {expense.expense_type}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-slate-900">
                              ${(expense.amount || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {selectedReceipt.parts.length > 0 ? 'Parts Total:' : 'Expense Total:'}
                      </span>
                      <span>${selectedReceipt.totalCost.toFixed(2)}</span>
                    </div>
                    {selectedReceipt.totalShipping > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="font-medium">Shipping:</span>
                        <span>${selectedReceipt.totalShipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold mt-2">
                      <span>Total:</span>
                      <span>${(selectedReceipt.totalCost + selectedReceipt.totalShipping).toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">Select a receipt to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Correct Receipt Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editedParts.map((part, idx) => (
              <Card key={idx} className={part._deleted ? "border-red-300 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}>
                <CardContent className="pt-4 space-y-3">
                  {part._deleted && (
                    <div className="flex items-center justify-between p-2 bg-red-100 rounded-lg border border-red-300 mb-2">
                      <span className="text-sm text-red-800 font-medium">This part will be deleted</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestorePart(idx)}
                      >
                        Undo
                      </Button>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-2 gap-3 flex-1">
                      <div>
                        <Label className="text-xs">Part Number</Label>
                        <Input
                          value={part.part_number}
                          onChange={(e) => {
                            const updated = [...editedParts];
                            updated[idx].part_number = e.target.value;
                            setEditedParts(updated);
                          }}
                          disabled={part._deleted}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={part.part_description}
                          onChange={(e) => {
                            const updated = [...editedParts];
                            updated[idx].part_description = e.target.value;
                            setEditedParts(updated);
                          }}
                          disabled={part._deleted}
                        />
                      </div>
                    </div>
                    {!part._deleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-5"
                        onClick={() => handleDeletePart(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => {
                          const updated = [...editedParts];
                          updated[idx].quantity = e.target.value;
                          setEditedParts(updated);
                        }}
                        disabled={part._deleted}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Cost</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={part.unit_cost}
                        onChange={(e) => {
                          const updated = [...editedParts];
                          updated[idx].unit_cost = e.target.value;
                          setEditedParts(updated);
                        }}
                        disabled={part._deleted}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Shipping</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={part.shipping_cost}
                        onChange={(e) => {
                          const updated = [...editedParts];
                          updated[idx].shipping_cost = e.target.value;
                          setEditedParts(updated);
                        }}
                        disabled={part._deleted}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Move className="w-3 h-3" />
                      Move to Receipt
                    </Label>
                    <Select
                      value={part.receipt_url}
                      onValueChange={(value) => {
                        const updated = [...editedParts];
                        updated[idx].receipt_url = value;
                        setEditedParts(updated);
                      }}
                      disabled={part._deleted}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReceipts.map((url, i) => (
                          <SelectItem key={i} value={url}>
                            Receipt {i + 1} {url === part.receipt_url ? '(Current)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClick}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Data Correction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              You are about to update <strong>{editedParts.filter(p => !p._deleted).length} parts</strong> from this receipt.
              {editedParts.filter(p => p._deleted).length > 0 && (
                <span className="text-red-600 font-medium">
                  {' '}and delete <strong>{editedParts.filter(p => p._deleted).length} parts</strong>.
                </span>
              )}
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ This will permanently modify the parts order data. Make sure all corrections are accurate.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSave}
              disabled={updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {updateMutation.isPending ? 'Updating...' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Receipt Confirmation */}
      <Dialog open={deleteReceiptDialogOpen} onOpenChange={setDeleteReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Entire Receipt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              You are about to permanently delete this receipt and all <strong>{selectedReceipt?.parts.length} parts</strong> associated with it.
            </p>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-800 font-medium">
                ⚠️ This action cannot be undone. All parts data will be permanently removed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReceiptDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDeleteReceipt}
              disabled={deleteReceiptMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteReceiptMutation.isPending ? 'Deleting...' : 'Delete Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}