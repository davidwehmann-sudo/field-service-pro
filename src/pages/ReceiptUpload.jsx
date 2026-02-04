import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, AlertCircle, Edit2 } from "lucide-react";
import { toast } from "sonner";

export default function ReceiptUpload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [manualMatches, setManualMatches] = useState({});

  const { data: vehicles = [] } = useQuery({
    queryKey: ['ownVehicles'],
    queryFn: () => base44.entities.OwnVehicle.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list(),
  });

  const { data: neededParts = [] } = useQuery({
    queryKey: ['neededParts'],
    queryFn: () => base44.entities.PartsOrder.filter({ status: 'needed' }),
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedData(null);
      setEditedData(null);
      setManualOverride(false);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleExtractData = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsProcessing(true);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data using AI
      const extractedInfo = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this receipt/invoice and extract ALL line items. Look for:
- Each individual part/product purchased
- Part numbers, descriptions, quantities, and unit prices
- Vendor/supplier information
- Date of purchase
- Total amount

If this is a parts receipt with multiple items, extract EACH line item separately.
If this is a single expense (fuel, service, etc), extract it as one item.`,
        file_urls: [file_url],
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            vendor: { type: "string" },
            receipt_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            total_amount: { type: "number", description: "Total on receipt" },
            category: { 
              type: "string", 
              enum: ["vehicle_expense", "parts_order", "other"],
              description: "Best guess at expense category"
            },
            expense_type: { 
              type: "string",
              description: "For vehicle expenses: fuel, maintenance, repair, upgrade, insurance, registration, other"
            },
            vehicle_hint: { 
              type: "string",
              description: "Any vehicle identifier mentioned"
            },
            line_items: {
              type: "array",
              description: "Individual line items from receipt",
              items: {
                type: "object",
                properties: {
                  part_number: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  line_total: { type: "number" }
                }
              }
            },
            confidence: { 
              type: "string",
              enum: ["high", "medium", "low"]
            }
          }
        }
      });

      setExtractedData({ ...extractedInfo, receipt_url: file_url });
      setEditedData({ ...extractedInfo, receipt_url: file_url });
      
      const itemCount = extractedInfo.line_items?.length || 1;
      toast.success(`Receipt data extracted: ${itemCount} item${itemCount > 1 ? 's' : ''} found`);
    } catch (error) {
      toast.error('Failed to extract receipt data: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveVehicleExpense = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.VehicleExpense.create(data);
    },
    onSuccess: () => {
      toast.success('Vehicle expense saved successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to save vehicle expense: ' + error.message);
    }
  });

  const savePartsOrder = useMutation({
    mutationFn: async (parts) => {
      // parts is an array
      if (Array.isArray(parts)) {
        return await base44.entities.PartsOrder.bulkCreate(parts);
      }
      return await base44.entities.PartsOrder.create(parts);
    },
    onSuccess: (_, parts) => {
      const count = Array.isArray(parts) ? parts.length : 1;
      toast.success(`${count} part${count > 1 ? 's' : ''} saved successfully`);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to save parts: ' + error.message);
    }
  });

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    setEditedData(null);
    setManualOverride(false);
    setShowManualMatch(false);
    setManualMatches({});
  };

  const handleSaveAsVehicleExpense = (vehicleId = null) => {
    const data = editedData || extractedData;
    const vehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null;

    saveVehicleExpense.mutate({
      expense_date: data.receipt_date || data.expense_date,
      vehicle_name: vehicle?.name || data.vehicle_hint || 'Unassigned',
      own_vehicle_id: vehicleId,
      expense_type: data.expense_type || 'other',
      description: data.line_items?.[0]?.description || data.description || 'Expense',
      vendor: data.vendor,
      amount: data.total_amount || data.amount,
      receipt_url: data.receipt_url,
      paid_by: 'company',
      notes: `AI extracted (${data.confidence} confidence)`
    });
  };

  const handleSaveAsPartsOrder = async (assignmentType = 'inventory', serviceReportId = null, customerId = null) => {
    const data = editedData || extractedData;

    // If line items exist, process multiple parts
    if (data.line_items && data.line_items.length > 0) {
      const partsToUpdate = [];
      const partsToCreate = [];

      for (let idx = 0; idx < data.line_items.length; idx++) {
        const item = data.line_items[idx];
        
        // Check for manual match first
        let matchingPart = null;
        if (manualMatches[idx]) {
          matchingPart = neededParts.find(p => p.id === manualMatches[idx]);
        } else if (item.part_number) {
          // Auto-match by part number
          matchingPart = neededParts.find(p => 
            p.part_number && p.part_number.trim().toLowerCase() === item.part_number.trim().toLowerCase()
          );
        }

        // If no match and no part number, create new
        if (!matchingPart && !item.part_number) {
          partsToCreate.push({
            assignment_type: assignmentType,
            service_report_id: serviceReportId,
            customer_id: customerId,
            part_number: '',
            part_description: item.description,
            quantity: item.quantity || 1,
            unit_cost: item.unit_price || 0,
            supplier: data.vendor,
            status: 'ordered',
            order_date: data.receipt_date,
            receipt_url: data.receipt_url,
            notes: `AI extracted from receipt (${data.confidence} confidence) - confirm receipt manually`
          });
          continue;
        }

        if (matchingPart) {
          // Match found - update existing part
          const priceDiff = matchingPart.unit_cost !== item.unit_price;
          const higherPrice = Math.max(matchingPart.unit_cost || 0, item.unit_price || 0);
          
          partsToUpdate.push({
            id: matchingPart.id,
            data: {
              unit_cost: higherPrice,
              supplier: data.vendor,
              status: 'ordered',
              order_date: data.receipt_date,
              receipt_url: data.receipt_url,
              notes: `${matchingPart.notes || ''}\n\n⚠️ ${manualMatches[idx] ? 'Manually matched' : 'Auto-matched'} from receipt upload. ${priceDiff ? `Price difference detected! Original: $${matchingPart.unit_cost}, Receipt: $${item.unit_price}, Using higher: $${higherPrice}` : 'Price matches.'} - Confirm receipt manually`
            }
          });
        } else if (!matchingPart) {
          // No match - create new part
          partsToCreate.push({
            assignment_type: assignmentType,
            service_report_id: serviceReportId,
            customer_id: customerId,
            part_number: item.part_number || '',
            part_description: item.description,
            quantity: item.quantity || 1,
            unit_cost: item.unit_price || 0,
            supplier: data.vendor,
            status: 'ordered',
            order_date: data.receipt_date,
            receipt_url: data.receipt_url,
            notes: `AI extracted from receipt (${data.confidence} confidence) - confirm receipt manually`
          });
        }
      }

      // Update matched parts
      for (const part of partsToUpdate) {
        await base44.entities.PartsOrder.update(part.id, part.data);
      }

      // Create new parts
      if (partsToCreate.length > 0) {
        await savePartsOrder.mutateAsync(partsToCreate);
      }

      const matched = partsToUpdate.length;
      const created = partsToCreate.length;
      toast.success(`${matched} part${matched !== 1 ? 's' : ''} matched and updated, ${created} new part${created !== 1 ? 's' : ''} created`);
      resetForm();
    } else {
      // Fallback to single item
      savePartsOrder.mutate({
        assignment_type: assignmentType,
        service_report_id: serviceReportId,
        customer_id: customerId,
        part_number: '',
        part_description: data.description || 'Receipt item',
        quantity: 1,
        unit_cost: data.total_amount || 0,
        supplier: data.vendor,
        status: 'ordered',
        order_date: data.receipt_date,
        receipt_url: data.receipt_url,
        notes: `AI extracted (${data.confidence} confidence) - confirm receipt manually`
      });
    }
  };

  const handleSaveUnassigned = () => {
    const data = editedData || extractedData;
    
    if (data.category === 'vehicle_expense') {
      handleSaveAsVehicleExpense(null);
    } else if (data.category === 'parts_order') {
      handleSaveAsPartsOrder('inventory', null, null);
    } else {
      // Default to vehicle expense for 'other' category
      handleSaveAsVehicleExpense(null);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const data = manualOverride ? editedData : extractedData;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Receipt Upload</h1>
        <p className="text-slate-600 mt-1">Upload receipts and let AI categorize them automatically</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              {preview ? (
                <img src={preview} alt="Receipt preview" className="max-h-64 mx-auto rounded-lg" />
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 mx-auto text-slate-400" />
                  <div>
                    <Label htmlFor="file-upload" className="cursor-pointer text-amber-600 hover:text-amber-700">
                      Choose a file
                    </Label>
                    <p className="text-sm text-slate-500 mt-1">or drag and drop</p>
                  </div>
                </div>
              )}
              <Input
                id="file-upload"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {file && (
              <div className="flex gap-2">
                <Button 
                  onClick={handleExtractData} 
                  disabled={isProcessing}
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Extract Data'
                  )}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extracted Data Section */}
        {extractedData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Extracted Data</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManualOverride(!manualOverride)}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                {manualOverride ? 'Lock' : 'Edit'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                {data.confidence === 'high' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {data.confidence === 'medium' && <AlertCircle className="w-4 h-4 text-yellow-600" />}
                {data.confidence === 'low' && <AlertCircle className="w-4 h-4 text-red-600" />}
                <span className="capitalize">{data.confidence} confidence</span>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Vendor</Label>
                  <Input
                    value={data.vendor || ''}
                    onChange={(e) => handleFieldChange('vendor', e.target.value)}
                    disabled={!manualOverride}
                  />
                </div>

                <div>
                  <Label>Total Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.total_amount || data.amount || ''}
                    onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value))}
                    disabled={!manualOverride}
                  />
                </div>

                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={data.receipt_date || data.expense_date || ''}
                    onChange={(e) => handleFieldChange('receipt_date', e.target.value)}
                    disabled={!manualOverride}
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Select
                    value={data.category}
                    onValueChange={(value) => handleFieldChange('category', value)}
                    disabled={!manualOverride}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle_expense">Vehicle Expense</SelectItem>
                      <SelectItem value="parts_order">Parts Order</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {data.line_items && data.line_items.length > 0 && (
                  <div className="pt-3 border-t">
                    <Label className="mb-2 block">Line Items ({data.line_items.length})</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.line_items.map((item, idx) => (
                        <div key={idx} className="p-2 bg-slate-50 rounded text-sm">
                          <div className="font-medium">{item.description}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            {item.part_number && <span>#{item.part_number} • </span>}
                            Qty: {item.quantity} × ${item.unit_price?.toFixed(2)} = ${item.line_total?.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Manual Matching */}
      {extractedData && data.line_items && data.line_items.length > 0 && neededParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Part Matching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Connect receipt items to needed parts (for cross-compatible parts)</p>
            <Button
              variant="outline"
              onClick={() => setShowManualMatch(!showManualMatch)}
              className="w-full"
            >
              {showManualMatch ? 'Hide' : 'Show'} Manual Matching
            </Button>

            {showManualMatch && (
              <div className="space-y-4 pt-2">
                {data.line_items.map((item, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="font-medium text-sm">
                      {item.description}
                      {item.part_number && <span className="text-slate-500 ml-2">#{item.part_number}</span>}
                    </div>
                    <Select
                      value={manualMatches[idx] || ''}
                      onValueChange={(value) => setManualMatches(prev => ({ ...prev, [idx]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Match to needed part..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No match</SelectItem>
                        {neededParts.map(part => (
                          <SelectItem key={part.id} value={part.id}>
                            {part.part_description} {part.part_number && `(#${part.part_number})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Assignment Options */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.category === 'vehicle_expense' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Assign to a vehicle:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {vehicles.map(vehicle => (
                    <Button
                      key={vehicle.id}
                      variant="outline"
                      onClick={() => handleSaveAsVehicleExpense(vehicle.id)}
                      disabled={saveVehicleExpense.isPending}
                    >
                      {vehicle.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {data.category === 'parts_order' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Assign to:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAsPartsOrder('inventory')}
                    disabled={savePartsOrder.isPending}
                  >
                    Add to Inventory
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSaveAsPartsOrder('counter_sale')}
                    disabled={savePartsOrder.isPending}
                  >
                    Counter Sale
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t flex gap-2">
              <Button
                onClick={handleSaveUnassigned}
                disabled={saveVehicleExpense.isPending || savePartsOrder.isPending}
                variant="outline"
                className="flex-1"
              >
                Save Unassigned (Handle Later)
              </Button>
              <Button
                onClick={resetForm}
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}