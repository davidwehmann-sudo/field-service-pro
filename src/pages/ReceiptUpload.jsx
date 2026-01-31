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
        prompt: `Analyze this receipt image and extract all relevant information. Determine what type of expense this is and provide structured data.`,
        file_urls: [file_url],
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            vendor: { type: "string" },
            amount: { type: "number" },
            expense_date: { type: "string", description: "Date in YYYY-MM-DD format" },
            description: { type: "string" },
            category: { 
              type: "string", 
              enum: ["vehicle_expense", "parts_order", "other"],
              description: "Best guess at expense category"
            },
            expense_type: { 
              type: "string",
              description: "For vehicle expenses: fuel, maintenance, repair, upgrade, insurance, registration, other. For parts: part purchase"
            },
            vehicle_hint: { 
              type: "string",
              description: "Any vehicle identifier mentioned (truck number, license plate, etc)"
            },
            part_number: { type: "string" },
            part_description: { type: "string" },
            quantity: { type: "number" },
            confidence: { 
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence level in the extraction"
            }
          }
        }
      });

      setExtractedData({ ...extractedInfo, receipt_url: file_url });
      setEditedData({ ...extractedInfo, receipt_url: file_url });
      toast.success('Receipt data extracted successfully');
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
    mutationFn: async (data) => {
      return await base44.entities.PartsOrder.create(data);
    },
    onSuccess: () => {
      toast.success('Parts order saved successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to save parts order: ' + error.message);
    }
  });

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    setEditedData(null);
    setManualOverride(false);
  };

  const handleSaveAsVehicleExpense = (vehicleId = null) => {
    const data = editedData || extractedData;
    const vehicle = vehicleId ? vehicles.find(v => v.id === vehicleId) : null;

    saveVehicleExpense.mutate({
      expense_date: data.expense_date,
      vehicle_name: vehicle?.name || data.vehicle_hint || 'Unassigned',
      own_vehicle_id: vehicleId,
      expense_type: data.expense_type || 'other',
      description: data.description,
      vendor: data.vendor,
      amount: data.amount,
      receipt_url: data.receipt_url,
      paid_by: 'company',
      notes: `AI extracted (${data.confidence} confidence)`
    });
  };

  const handleSaveAsPartsOrder = (assignmentType = 'inventory', serviceReportId = null, customerId = null) => {
    const data = editedData || extractedData;

    savePartsOrder.mutate({
      assignment_type: assignmentType,
      service_report_id: serviceReportId,
      customer_id: customerId,
      part_number: data.part_number || '',
      part_description: data.part_description || data.description,
      quantity: data.quantity || 1,
      unit_cost: data.amount || 0,
      supplier: data.vendor,
      status: 'received',
      receipt_url: data.receipt_url,
      notes: `AI extracted (${data.confidence} confidence)`
    });
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
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.amount || ''}
                    onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value))}
                    disabled={!manualOverride}
                  />
                </div>

                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={data.expense_date || ''}
                    onChange={(e) => handleFieldChange('expense_date', e.target.value)}
                    disabled={!manualOverride}
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Input
                    value={data.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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