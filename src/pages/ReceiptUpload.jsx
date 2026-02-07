import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle2, AlertCircle, Edit2, AlertTriangle, CheckCircle } from "lucide-react";
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
  const [multiMatchConfirm, setMultiMatchConfirm] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [verificationMatches, setVerificationMatches] = useState({});
  const [acknowledgeUnverified, setAcknowledgeUnverified] = useState(false);

  const queryClient = useQueryClient();

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

  const { data: inventory = [] } = useQuery({
    queryKey: ['partsInventory'],
    queryFn: () => base44.entities.PartsInventory.list(),
  });

  const { data: existingPartsOrders = [] } = useQuery({
    queryKey: ['allPartsOrders'],
    queryFn: () => base44.entities.PartsOrder.list(),
  });

  const { data: existingVehicleExpenses = [] } = useQuery({
    queryKey: ['allVehicleExpenses'],
    queryFn: () => base44.entities.VehicleExpense.list(),
  });

  const { data: verificationLibrary = [] } = useQuery({
    queryKey: ['partVerifications'],
    queryFn: () => base44.entities.PartVerification.list(),
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
      
      // Auto-suggest verification matches
      if (extractedInfo.line_items && extractedInfo.line_items.length > 0) {
        const suggestions = {};
        extractedInfo.line_items.forEach((item, idx) => {
          if (item.part_number) {
            // Find best match by part number
            const match = verificationLibrary.find(v => 
              v.part_number.toLowerCase().trim() === item.part_number.toLowerCase().trim()
            );
            if (match) {
              suggestions[idx] = match.id;
            }
          }
        });
        setVerificationMatches(suggestions);
      }
      
      // Check for duplicates
      const duplicates = checkForDuplicates(extractedInfo, file_url);
      if (duplicates.length > 0) {
        setDuplicateWarning({
          data: { ...extractedInfo, receipt_url: file_url },
          duplicates
        });
      }
      
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
    setDuplicateWarning(null);
  };

  const checkForDuplicates = (extractedInfo, receipt_url) => {
    const duplicates = [];
    
    // Check if exact receipt URL already exists
    const urlMatch = [...existingPartsOrders, ...existingVehicleExpenses].find(
      record => record.receipt_url === receipt_url
    );
    
    if (urlMatch) {
      duplicates.push({
        type: 'exact',
        message: 'This exact receipt file has already been uploaded',
        record: urlMatch
      });
      return duplicates;
    }
    
    // Check for similar receipts (same vendor, date, and amount within $0.10)
    const vendor = extractedInfo.vendor?.toLowerCase().trim();
    const date = extractedInfo.receipt_date;
    const amount = extractedInfo.total_amount;
    
    if (vendor && date && amount) {
      const similarExpenses = existingVehicleExpenses.filter(expense => 
        expense.vendor?.toLowerCase().trim() === vendor &&
        expense.expense_date === date &&
        Math.abs((expense.amount || 0) - amount) < 0.10
      );
      
      const similarOrders = existingPartsOrders.filter(order => 
        order.supplier?.toLowerCase().trim() === vendor &&
        order.order_date === date &&
        Math.abs((order.unit_cost || 0) * (order.quantity || 1) - amount) < 0.10
      );
      
      if (similarExpenses.length > 0) {
        duplicates.push({
          type: 'similar',
          message: `${similarExpenses.length} similar vehicle expense(s) already exist`,
          records: similarExpenses
        });
      }
      
      if (similarOrders.length > 0) {
        duplicates.push({
          type: 'similar',
          message: `${similarOrders.length} similar parts order(s) already exist`,
          records: similarOrders
        });
      }
    }
    
    return duplicates;
  };

  const handleSaveAsVehicleExpense = (vehicleId = null) => {
    const data = editedData || extractedData;
    
    // Check for duplicates before saving
    if (!duplicateWarning) {
      const duplicates = checkForDuplicates(data, data.receipt_url);
      if (duplicates.length > 0) {
        setDuplicateWarning({
          data,
          duplicates,
          callback: () => handleSaveAsVehicleExpense(vehicleId)
        });
        return;
      }
    }
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
    
    // Check verification for all line items (except shipping and consumables)
    if (data.line_items && data.line_items.length > 0) {
      const missingVerification = data.line_items.some((item, idx) => {
        const isShipping = /shipping|freight|delivery|transport/i.test(item.description || '');
        const isConsumable = /shop\s*(towel|rag|cloth)|glove|wipe|cleaner|degreaser|soap|hand\s*clean|safety\s*glass|ppe|first\s*aid/i.test(item.description || '');
        return !isShipping && !isConsumable && !verificationMatches[idx];
      });
      if (missingVerification && !acknowledgeUnverified) {
        toast.error('Please verify all parts/fluids or acknowledge they will be verified later');
        return;
      }
    }
    
    // Check for duplicates before saving (skip if already confirmed)
    if (!duplicateWarning) {
      const duplicates = checkForDuplicates(data, data.receipt_url);
      if (duplicates.length > 0) {
        setDuplicateWarning({
          data,
          duplicates,
          callback: () => handleSaveAsPartsOrder(assignmentType, serviceReportId, customerId)
        });
        return;
      }
    }

    // If line items exist, process multiple parts
    if (data.line_items && data.line_items.length > 0) {
      const partsToUpdate = [];
      const partsToCreate = [];

      for (let idx = 0; idx < data.line_items.length; idx++) {
        const item = data.line_items[idx];
        
        // Check for manual match first
        let matchingParts = [];
        let matchType = null;
        
        if (manualMatches[idx]) {
          const manualPart = neededParts.find(p => p.id === manualMatches[idx]);
          if (manualPart) {
            matchingParts = [manualPart];
            matchType = 'manual';
          }
        } else if (item.part_number) {
          // First, try direct part number match (could be multiple)
          const directMatches = neededParts.filter(p => 
            p.part_number && p.part_number.trim().toLowerCase() === item.part_number.trim().toLowerCase()
          );
          
          if (directMatches.length > 0) {
            matchingParts = directMatches;
            matchType = 'direct';
          } else {
            // Check cross-compatible part numbers in inventory
            const inventoryItem = inventory.find(inv => 
              inv.cross_compatible_part_numbers && 
              inv.cross_compatible_part_numbers.some(cpn => 
                cpn.trim().toLowerCase() === item.part_number.trim().toLowerCase()
              )
            );
            
            if (inventoryItem) {
              // Find all needed parts that match this inventory part number
              const crossMatches = neededParts.filter(p => 
                p.part_number && p.part_number.trim().toLowerCase() === inventoryItem.part_number.trim().toLowerCase()
              );
              if (crossMatches.length > 0) {
                matchingParts = crossMatches;
                matchType = 'cross-compatible';
              }
            }
          }
        }

        // If multiple matches found, confirm they're cross-compatible
        if (matchingParts.length > 1 && !multiMatchConfirm) {
          setMultiMatchConfirm({
            item,
            matchingParts,
            matchType,
            callback: () => handleSaveAsPartsOrder(assignmentType, serviceReportId, customerId)
          });
          return;
        }

        // Get verification from matched library entry
        const verification = verificationMatches[idx];
        const isShipping = /shipping|freight|delivery|transport/i.test(item.description || '');
        const isConsumable = /shop\s*(towel|rag|cloth)|glove|wipe|cleaner|degreaser|soap|hand\s*clean|safety\s*glass|ppe|first\s*aid/i.test(item.description || '');
        
        // If no matches and no part number, create new
        if (matchingParts.length === 0 && !item.part_number) {
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
            verification_source: verification?.source_name || 'Unknown',
            verification_details: verification?.source_details || 'Verification required',
            verification_photo_url: verification?.photo_url,
            notes: `AI extracted from receipt (${data.confidence} confidence) - confirm receipt manually`
          });
          continue;
        }

        if (matchingParts.length > 0) {
          // Match(es) found - update all matching parts
          for (const matchingPart of matchingParts) {
            const currentCost = matchingPart.unit_cost || 0;
            const receiptCost = item.unit_price || 0;
            const priceDiff = currentCost !== receiptCost;
            const higherPrice = Math.max(currentCost, receiptCost);
            
            const matchDescription = matchType === 'manual' ? 'Manually matched' : 
                                     matchType === 'cross-compatible' ? `Auto-matched via cross-compatible part#: ${item.part_number}` :
                                     matchingParts.length > 1 ? `Auto-matched (${matchingParts.length} cross-compatible parts updated)` :
                                     'Auto-matched';
            
            partsToUpdate.push({
              id: matchingPart.id,
              data: {
                unit_cost: higherPrice,
                supplier: data.vendor,
                status: 'ordered',
                order_date: data.receipt_date,
                receipt_url: data.receipt_url,
                notes: `${matchingPart.notes || ''}\n\n⚠️ ${matchDescription} from receipt upload. ${priceDiff ? `Price difference detected! Original: $${currentCost.toFixed(2)}, Receipt: $${receiptCost.toFixed(2)}, Using higher: $${higherPrice.toFixed(2)}` : 'Price matches.'} - Confirm receipt manually`
              },
              receiptPartNumber: item.part_number,
              inventoryPartNumber: matchingPart.part_number,
              wasManualMatch: matchType === 'manual',
              wasCrossCompatMatch: matchType === 'cross-compatible'
            });
          }
        } else if (matchingParts.length === 0 && item.part_number) {
          // No match - create new part with verification
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
            verification_source: isShipping ? 'Shipping Cost' : isConsumable ? 'Shop Consumable' : (verification?.source_name || 'PENDING VERIFICATION'),
            verification_details: isShipping ? 'Shipping/freight charge' : isConsumable ? 'General shop consumable item' : (verification?.source_details || '⚠️ NEEDS VERIFICATION - Upload to library'),
            verification_photo_url: verification?.photo_url,
            notes: `AI extracted from receipt (${data.confidence} confidence) - confirm receipt manually${!verification && !isShipping && !isConsumable ? '\n\n⚠️ VERIFICATION PENDING - Add to parts library with proper diagram/spec documentation' : ''}`
          });
        }
      }

      // Update matched parts and save cross-compatible associations
      const inventoryUpdates = new Map();
      
      for (const part of partsToUpdate) {
        await base44.entities.PartsOrder.update(part.id, part.data);
        
        // Save bidirectional cross-compatible associations
        if ((part.wasManualMatch || part.wasCrossCompatMatch) && part.receiptPartNumber && part.inventoryPartNumber && 
            part.receiptPartNumber.trim().toLowerCase() !== part.inventoryPartNumber.trim().toLowerCase()) {
          
          // Find or create inventory item for the needed part's number
          let inventoryItem = inventory.find(inv => 
            inv.part_number && inv.part_number.trim().toLowerCase() === part.inventoryPartNumber.trim().toLowerCase()
          );
          
          if (inventoryItem) {
            const existingCrossCompat = inventoryItem.cross_compatible_part_numbers || [];
            if (!existingCrossCompat.some(cpn => cpn.trim().toLowerCase() === part.receiptPartNumber.trim().toLowerCase())) {
              // Store update to avoid duplicate updates
              if (!inventoryUpdates.has(inventoryItem.id)) {
                inventoryUpdates.set(inventoryItem.id, {
                  id: inventoryItem.id,
                  cross_compatible: [...existingCrossCompat, part.receiptPartNumber]
                });
              } else {
                const existing = inventoryUpdates.get(inventoryItem.id);
                if (!existing.cross_compatible.includes(part.receiptPartNumber)) {
                  existing.cross_compatible.push(part.receiptPartNumber);
                }
              }
            }
          } else {
            // No inventory item found - log this for user awareness
            toast.info(`Part #${part.inventoryPartNumber} not in inventory - cross-reference not saved`);
          }
          
          // Also check for bidirectional - find inventory with receipt part number
          const receiptInventoryItem = inventory.find(inv => 
            inv.part_number && inv.part_number.trim().toLowerCase() === part.receiptPartNumber.trim().toLowerCase()
          );
          
          if (receiptInventoryItem) {
            const existingCrossCompat = receiptInventoryItem.cross_compatible_part_numbers || [];
            if (!existingCrossCompat.some(cpn => cpn.trim().toLowerCase() === part.inventoryPartNumber.trim().toLowerCase())) {
              if (!inventoryUpdates.has(receiptInventoryItem.id)) {
                inventoryUpdates.set(receiptInventoryItem.id, {
                  id: receiptInventoryItem.id,
                  cross_compatible: [...existingCrossCompat, part.inventoryPartNumber]
                });
              } else {
                const existing = inventoryUpdates.get(receiptInventoryItem.id);
                if (!existing.cross_compatible.includes(part.inventoryPartNumber)) {
                  existing.cross_compatible.push(part.inventoryPartNumber);
                }
              }
            }
          }
        }
      }
      
      // Apply all inventory updates
      for (const update of inventoryUpdates.values()) {
        try {
          await base44.entities.PartsInventory.update(update.id, {
            cross_compatible_part_numbers: update.cross_compatible
          });
        } catch (error) {
          toast.error(`Failed to update cross-compatible references: ${error.message}`);
        }
      }
      
      // Invalidate inventory query to refresh cross-compatible data
      if (inventoryUpdates.size > 0) {
        queryClient.invalidateQueries(['partsInventory']);
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
      // Fallback to single item - requires verification
      const verification = verificationMatches[0];
      if (!verification) {
        toast.error('Please verify the part against the library before saving');
        return;
      }
      
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
        verification_source: verification.source_name,
        verification_details: verification.source_details,
        verification_photo_url: verification.photo_url,
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
                file?.type === 'application/pdf' ? (
                  <div className="space-y-2">
                    <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>
                    </div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-500">PDF Receipt</p>
                  </div>
                ) : (
                  <img src={preview} alt="Receipt preview" className="max-h-64 mx-auto rounded-lg" />
                )
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Review Extracted Data</CardTitle>
                <Button
                  variant={manualOverride ? "default" : "outline"}
                  size="sm"
                  onClick={() => setManualOverride(!manualOverride)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {manualOverride ? 'Editing' : 'Edit'}
                </Button>
              </div>
              
              {/* Confidence Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mt-2 ${
                data.confidence === 'high' ? 'bg-green-50 text-green-700 border border-green-200' :
                data.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {data.confidence === 'high' && <CheckCircle2 className="w-4 h-4" />}
                {data.confidence !== 'high' && <AlertCircle className="w-4 h-4" />}
                <span className="capitalize">{data.confidence} Confidence</span>
                {data.confidence !== 'high' && <span className="text-xs opacity-75">• Review carefully</span>}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Summary Box */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Vendor</p>
                    <p className="font-semibold text-slate-900">{data.vendor || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                    <p className="font-semibold text-slate-900 text-lg">
                      ${(data.total_amount || data.amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Date</p>
                    <p className="font-semibold text-slate-900">{data.receipt_date || data.expense_date || 'Not found'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Type</p>
                    <p className="font-semibold text-slate-900 capitalize">{data.category?.replace('_', ' ') || 'Unknown'}</p>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              {manualOverride && (
                <div className="space-y-3 p-4 border-2 border-amber-200 rounded-lg bg-amber-50">
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Edit Mode - Make corrections below
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Vendor/Supplier</Label>
                      <Input
                        value={data.vendor || ''}
                        onChange={(e) => handleFieldChange('vendor', e.target.value)}
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Total Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={data.total_amount || data.amount || ''}
                        onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value))}
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Receipt Date</Label>
                      <Input
                        type="date"
                        value={data.receipt_date || data.expense_date || ''}
                        onChange={(e) => handleFieldChange('receipt_date', e.target.value)}
                        className="bg-white"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={data.category}
                        onValueChange={(value) => handleFieldChange('category', value)}
                      >
                        <SelectTrigger className="bg-white">
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
                </div>
              )}

              {/* Line Items */}
              {data.line_items && data.line_items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">
                      Line Items Found ({data.line_items.length})
                    </Label>
                    <span className="text-xs text-slate-500">
                      Total: ${data.line_items.reduce((sum, item) => sum + (item.line_total || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.line_items.map((item, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{item.description}</p>
                            {item.part_number && (
                              <p className="text-xs text-slate-500 mt-1">
                                Part #: <span className="font-mono font-semibold">{item.part_number}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-semibold text-slate-900">${item.line_total?.toFixed(2)}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {item.quantity} × ${item.unit_price?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Line Items Message */}
              {(!data.line_items || data.line_items.length === 0) && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-sm text-slate-600">No individual line items detected</p>
                  <p className="text-xs text-slate-500 mt-1">This will be recorded as a single expense</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Verification Library Matching - REQUIRED */}
      {extractedData && data.line_items && data.line_items.length > 0 && (
        <Card className="border-2 border-amber-500">
          <CardHeader className="bg-amber-50">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Verify Parts (Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900 font-medium mb-2">⚠️ Important: Part & Fluid Verification Required</p>
              <p className="text-xs text-blue-800 mb-2">
                <strong>Parts and fluids</strong> must be verified against technical documentation (parts diagrams, manuals, fluid specs) before saving.
              </p>
              <p className="text-xs text-blue-800">
                <strong>Auto-verified items:</strong> Shipping/freight charges and shop consumables (towels, gloves, cleaners, etc.) don't require verification.
              </p>
            </div>

            {data.line_items.map((item, idx) => {
              const selectedVerification = verificationMatches[idx] ? 
                verificationLibrary.find(v => v.id === verificationMatches[idx]) : null;
              const isShipping = /shipping|freight|delivery|transport/i.test(item.description || '');
              const isConsumable = /shop\s*(towel|rag|cloth)|glove|wipe|cleaner|degreaser|soap|hand\s*clean|safety\s*glass|ppe|first\s*aid/i.test(item.description || '');
              const isFluid = /hydraulic|coolant|gear\s*oil|grease|engine\s*oil|transmission\s*fluid|brake\s*fluid|antifreeze/i.test(item.description || '');
              
              return (
                <div key={idx} className={`p-4 border-2 rounded-lg ${
                  isShipping || isConsumable ? 'border-blue-200 bg-blue-50' : 
                  selectedVerification ? 'border-green-200 bg-green-50' : 
                  'border-red-200 bg-red-50'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.description}</p>
                        {item.part_number && (
                          <p className="text-sm text-slate-600 mt-1">Receipt Part #: {item.part_number}</p>
                        )}
                        {isShipping && (
                          <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Shipping cost - no verification required
                          </p>
                        )}
                        {isConsumable && (
                          <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Shop consumable - no verification required
                          </p>
                        )}
                        {isFluid && !selectedVerification && (
                          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Fluid/lubricant - must verify meets machine specs
                          </p>
                        )}
                      </div>
                      {isShipping || isConsumable ? (
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      ) : selectedVerification ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                    </div>

                    {!isShipping && !isConsumable && (
                    <div>
                      <Label className="text-xs mb-2 block">Match to Library Verification *</Label>
                      <Select
                        value={verificationMatches[idx] || ''}
                        onValueChange={(value) => setVerificationMatches(prev => ({ ...prev, [idx]: value }))}
                      >
                        <SelectTrigger className={selectedVerification ? "border-green-300 bg-white" : "border-red-300 bg-white"}>
                          <SelectValue placeholder="Select verification source..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {(() => {
                            // Sort verifications to show best matches first
                            const sortedVerifications = [...verificationLibrary].sort((a, b) => {
                              const aPartMatch = item.part_number && a.part_number.toLowerCase().trim() === item.part_number.toLowerCase().trim();
                              const bPartMatch = item.part_number && b.part_number.toLowerCase().trim() === item.part_number.toLowerCase().trim();
                              
                              if (aPartMatch && !bPartMatch) return -1;
                              if (!aPartMatch && bPartMatch) return 1;
                              
                              const aDescMatch = item.description && a.part_description && 
                                a.part_description.toLowerCase().includes(item.description.toLowerCase().substring(0, 20));
                              const bDescMatch = item.description && b.part_description && 
                                b.part_description.toLowerCase().includes(item.description.toLowerCase().substring(0, 20));
                              
                              if (aDescMatch && !bDescMatch) return -1;
                              if (!aDescMatch && bDescMatch) return 1;
                              
                              return 0;
                            });
                            
                            return sortedVerifications.map((verification, vIdx) => {
                              const isTopMatch = vIdx === 0 && item.part_number && 
                                verification.part_number.toLowerCase().trim() === item.part_number.toLowerCase().trim();
                              
                              return (
                                <SelectItem key={verification.id} value={verification.id}>
                                  <div className="py-1">
                                    <div className={`font-medium ${isTopMatch ? 'text-green-700' : ''}`}>
                                      {isTopMatch && '⭐ '}
                                      {verification.part_number} - {verification.machine_model}
                                    </div>
                                    <div className="text-xs text-slate-600">{verification.source_name}</div>
                                  </div>
                                </SelectItem>
                              );
                            });
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    )}

                    {selectedVerification && !isShipping && (
                      <div className="p-3 bg-white rounded border border-green-200">
                        <p className="text-xs text-slate-500 mb-2">Verification Details:</p>
                        <div className="space-y-1 text-sm">
                          <p><strong>Source:</strong> {selectedVerification.source_name}</p>
                          <p><strong>Details:</strong> {selectedVerification.source_details}</p>
                          <p><strong>Machine:</strong> {selectedVerification.machine_model}</p>
                          {selectedVerification.part_description && (
                            <p><strong>Description:</strong> {selectedVerification.part_description}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {data.line_items.some((item, idx) => {
              const isShipping = /shipping|freight|delivery|transport/i.test(item.description || '');
              const isConsumable = /shop\s*(towel|rag|cloth)|glove|wipe|cleaner|degreaser|soap|hand\s*clean|safety\s*glass|ppe|first\s*aid/i.test(item.description || '');
              return !isShipping && !isConsumable && !verificationMatches[idx];
            }) && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900 font-medium">
                    ⚠️ Missing verifications - parts and fluids need verification
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Note: Shipping and consumables (shop supplies) don't require verification. Fluids and parts must be verified against technical documentation.
                  </p>
                </div>
                
                <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgeUnverified}
                      onChange={(e) => setAcknowledgeUnverified(e.target.checked)}
                      className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        I acknowledge these items need verification
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        By checking this box, I understand that unverified parts/fluids must be properly verified 
                        through the Parts Library page with appropriate diagrams, manuals, or specification documentation 
                        before they can be installed or used.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Parts will auto-match to needed parts on order
                  </p>
                  <p className="text-xs text-blue-700">
                    System will check part numbers and cross-compatible references to link this receipt to existing parts orders
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleSaveAsPartsOrder('inventory')}
                    disabled={savePartsOrder.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Process Receipt & Match Parts
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

      {/* Multi-Match Confirmation Dialog */}
      {multiMatchConfirm && (
        <Dialog open={!!multiMatchConfirm} onOpenChange={(open) => !open && setMultiMatchConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Multiple Parts Match
              </DialogTitle>
              <DialogDescription>
                Receipt item "{multiMatchConfirm.item.description}" ({multiMatchConfirm.item.part_number}) matches {multiMatchConfirm.matchingParts.length} needed parts.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                These parts will all be updated and marked as cross-compatible:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {multiMatchConfirm.matchingParts.map(part => (
                  <div key={part.id} className="p-2 bg-slate-50 rounded text-sm">
                    <div className="font-medium">{part.part_description}</div>
                    <div className="text-xs text-slate-500">
                      {part.part_number && `#${part.part_number} • `}
                      Qty: {part.quantity} • ${part.unit_cost?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 italic">
                All matching parts will receive the receipt data and be linked as cross-compatible.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMultiMatchConfirm(null)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setMultiMatchConfirm(null);
                if (multiMatchConfirm.callback) {
                  multiMatchConfirm.callback();
                }
              }}>
                Confirm & Update All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Duplicate Warning Dialog */}
      {duplicateWarning && (
        <Dialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Possible Duplicate Receipt
              </DialogTitle>
              <DialogDescription>
                This receipt may have already been recorded.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {duplicateWarning.duplicates.map((dup, idx) => (
                <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-sm text-red-900">{dup.message}</p>
                  {dup.type === 'exact' && (
                    <p className="text-xs text-red-700 mt-1">
                      This exact file was previously uploaded.
                    </p>
                  )}
                  {dup.type === 'similar' && dup.records && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {dup.records.slice(0, 3).map((record, i) => (
                        <div key={i} className="text-xs text-red-800">
                          • {record.vendor || record.supplier} - {record.expense_date || record.order_date} - ${record.amount || (record.unit_cost * record.quantity) || 0}
                        </div>
                      ))}
                      {dup.records.length > 3 && (
                        <div className="text-xs text-red-700">
                          ...and {dup.records.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              <p className="text-sm text-slate-600 pt-2">
                Are you sure you want to record this receipt again?
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateWarning(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  const callback = duplicateWarning.callback;
                  setDuplicateWarning(null);
                  if (callback) {
                    callback();
                  }
                }}
              >
                Record Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}