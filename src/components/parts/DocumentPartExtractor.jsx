import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription 
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
    Upload, 
    Loader2, 
    FileText, 
    CheckCircle2,
    Save,
    Package,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function DocumentPartExtractor({ 
    isOpen, 
    onClose, 
    onPartsExtracted,
    defaultMachineModel 
}) {
    const [uploading, setUploading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [selectedParts, setSelectedParts] = useState({});
    const [machineModel, setMachineModel] = useState(defaultMachineModel || '');
    const [manufacturer, setManufacturer] = useState('');
    const [bypassMachineModel, setBypassMachineModel] = useState(false);
    const [saving, setSaving] = useState(false);
    const [duplicateData, setDuplicateData] = useState(null);
    const [duplicateAction, setDuplicateAction] = useState('skip');

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            
            setExtracting(true);
            const result = await base44.functions.invoke('extractPartsFromDocument', {
                file_url,
                machine_model: bypassMachineModel ? 'N/A' : machineModel
            });

            if (result.data.success) {
                setExtractedData(result.data);
                // Pre-select all parts
                const preSelected = {};
                result.data.parts.forEach((_, idx) => {
                    preSelected[idx] = true;
                });
                setSelectedParts(preSelected);
                toast.success(`Extracted ${result.data.parts.length} parts from document`);
            } else {
                toast.error('Failed to extract parts from document');
            }
        } catch (error) {
            toast.error('Error processing document: ' + error.message);
        } finally {
            setUploading(false);
            setExtracting(false);
        }
    };

    const handleSaveToLibrary = async () => {
        if (!extractedData) return;

        const selectedPartsList = extractedData.parts.filter((_, idx) => selectedParts[idx]);
        
        if (selectedPartsList.length === 0) {
            toast.error('Please select at least one part');
            return;
        }

        if (!bypassMachineModel && !machineModel.trim()) {
            toast.error('Please enter machine model or check bypass');
            return;
        }

        setSaving(true);
        try {
            const user = await base44.auth.me();
            
            // Check for duplicates
            const existingVerifications = await base44.entities.PartVerification.list();
            const duplicates = [];
            const newParts = [];
            
            selectedPartsList.forEach(part => {
                const existing = existingVerifications.find(v => 
                    v.part_number?.toLowerCase() === part.part_number?.toLowerCase() &&
                    v.machine_model?.toLowerCase() === (bypassMachineModel ? 'n/a' : machineModel.toLowerCase())
                );
                
                if (existing) {
                    duplicates.push({
                        newPart: part,
                        existing: existing
                    });
                } else {
                    newParts.push(part);
                }
            });

            // If duplicates found, show dialog
            if (duplicates.length > 0) {
                setDuplicateData({
                    duplicates,
                    newParts,
                    selectedPartsList,
                    user
                });
                setSaving(false);
                return;
            }

            // No duplicates, proceed with save
            await saveParts(selectedPartsList, user);
        } catch (error) {
            toast.error('Error saving to library: ' + error.message);
            setSaving(false);
        }
    };

    const handleDuplicateResolution = async () => {
        if (!duplicateData) return;

        setSaving(true);
        try {
            const { duplicates, newParts, selectedPartsList, user } = duplicateData;

            if (duplicateAction === 'skip') {
                // Only save new parts
                if (newParts.length > 0) {
                    await saveParts(newParts, user);
                    toast.success(`Saved ${newParts.length} new parts, skipped ${duplicates.length} duplicates`);
                } else {
                    toast.info('No new parts to save - all were duplicates');
                }
            } else if (duplicateAction === 'replace') {
                // Delete existing duplicates and save all
                for (const dup of duplicates) {
                    await base44.entities.PartVerification.delete(dup.existing.id);
                }
                await saveParts(selectedPartsList, user);
                toast.success(`Replaced ${duplicates.length} duplicates and saved ${newParts.length} new parts`);
            } else if (duplicateAction === 'manual') {
                toast.info('Cancelled - review duplicates manually');
                setDuplicateData(null);
                setSaving(false);
                return;
            }

            // Reset and close
            setExtractedData(null);
            setSelectedParts({});
            setDuplicateData(null);
            onClose();
        } catch (error) {
            toast.error('Error handling duplicates: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const saveParts = async (partsList, user) => {
        const verifications = partsList.map(part => ({
            part_number: part.part_number,
            part_description: part.part_description,
            manufacturer: manufacturer || part.manufacturer || extractedData.manufacturer,
            source_name: extractedData.source_name,
            source_details: part.source_details,
            photo_url: extractedData.photo_url,
            machine_model: bypassMachineModel ? 'N/A' : machineModel,
            service_company: user.current_company || user.company
        }));

        await base44.entities.PartVerification.bulkCreate(verifications);

        // Pass back to parent for immediate use
        if (onPartsExtracted) {
            onPartsExtracted(partsList, extractedData, verifications);
        }
    };

    const togglePart = (idx) => {
        setSelectedParts(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const selectedCount = Object.values(selectedParts).filter(Boolean).length;

    return (
        <>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Extract Parts from Document</DialogTitle>
                    <DialogDescription>
                        Upload a parts diagram, manual, or invoice to automatically extract part information
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Manufacturer Input */}
                    <div className="space-y-2">
                        <Label>Manufacturer (Optional)</Label>
                        <Input
                            placeholder="e.g., Caterpillar, John Deere, Kubota"
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">
                            Override manufacturer if AI detection is incorrect
                        </p>
                    </div>

                    {/* Machine Model Input */}
                    <div className="space-y-2">
                        <Label>Machine Model *</Label>
                        <div className="flex gap-2 items-start">
                            <Input
                                placeholder="e.g., CAT 416E, JD 310K"
                                value={machineModel}
                                onChange={(e) => setMachineModel(e.target.value)}
                                disabled={bypassMachineModel}
                                className="flex-1"
                            />
                            <div className="flex items-center gap-2 pt-2">
                                <Checkbox
                                    id="bypass-model"
                                    checked={bypassMachineModel}
                                    onCheckedChange={setBypassMachineModel}
                                />
                                <Label htmlFor="bypass-model" className="text-sm font-normal cursor-pointer">
                                    N/A
                                </Label>
                            </div>
                        </div>
                        {!bypassMachineModel && !machineModel && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Required for verification library
                            </p>
                        )}
                    </div>

                    {/* File Upload */}
                    {!extractedData && (
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                            <input
                                type="file"
                                id="document-upload"
                                className="hidden"
                                accept="image/*,.pdf"
                                onChange={handleFileUpload}
                                disabled={uploading || extracting}
                            />
                            <label 
                                htmlFor="document-upload"
                                className="cursor-pointer"
                            >
                                {(uploading || extracting) ? (
                                    <div className="space-y-3">
                                        <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                                        <p className="text-slate-600">
                                            {uploading ? 'Uploading...' : 'Analyzing document with AI...'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                                        <div>
                                            <p className="text-slate-600 font-medium">
                                                Click to upload document
                                            </p>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Supports images and PDFs
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </label>
                        </div>
                    )}

                    {/* Extracted Parts List */}
                    {extractedData && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    <div>
                                        <h3 className="font-semibold">{extractedData.source_name}</h3>
                                        <p className="text-sm text-slate-600">
                                            {extractedData.parts.length} parts extracted • {selectedCount} selected
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        setExtractedData(null);
                                        setSelectedParts({});
                                    }}
                                    variant="outline"
                                    size="sm"
                                >
                                    Upload Different
                                </Button>
                            </div>

                            {/* Document Preview */}
                            {extractedData.photo_url && (
                                <div className="border rounded-lg overflow-hidden bg-slate-50">
                                    <div className="bg-slate-100 px-3 py-2 border-b">
                                        <p className="text-xs font-medium text-slate-700">Source Document</p>
                                    </div>
                                    <div className="p-4 max-h-[400px] overflow-auto">
                                        <img 
                                            src={extractedData.photo_url} 
                                            alt="Source document"
                                            className="w-full h-auto rounded"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2 mb-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const allSelected = {};
                                        extractedData.parts.forEach((_, idx) => {
                                            allSelected[idx] = true;
                                        });
                                        setSelectedParts(allSelected);
                                    }}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedParts({})}
                                >
                                    Deselect All
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {extractedData.parts.map((part, idx) => (
                                    <Card 
                                        key={idx}
                                        className={selectedParts[idx] ? 'ring-2 ring-primary' : ''}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    checked={selectedParts[idx] || false}
                                                    onCheckedChange={() => togglePart(idx)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className="font-mono font-semibold">
                                                                {part.part_number}
                                                            </p>
                                                            <p className="text-sm text-slate-600">
                                                                {part.part_description}
                                                            </p>
                                                        </div>
                                                        {selectedParts[idx] && (
                                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline" className="text-xs">
                                                            {part.source_details}
                                                        </Badge>
                                                        {part.quantity && (
                                                            <Badge className="text-xs bg-blue-100 text-blue-800">
                                                                Qty: {part.quantity}
                                                            </Badge>
                                                        )}
                                                        {part.unit_cost && (
                                                            <Badge className="text-xs bg-green-100 text-green-800">
                                                                ${part.unit_cost.toFixed(2)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-4 border-t">
                                <Button
                                    onClick={handleSaveToLibrary}
                                    disabled={saving || selectedCount === 0 || (!bypassMachineModel && !machineModel.trim())}
                                    className="flex-1"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving to Library...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save {selectedCount} to Library
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {/* Duplicate Handling Dialog */}
        <AlertDialog open={!!duplicateData} onOpenChange={(open) => !open && setDuplicateData(null)}>
            <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Duplicate Parts Detected</AlertDialogTitle>
                    <AlertDialogDescription>
                        Found {duplicateData?.duplicates.length} part(s) already in the library with the same part number and machine model.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {duplicateData && (
                    <div className="space-y-4">
                        {/* Duplicate List */}
                        <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-3 bg-slate-50">
                            {duplicateData.duplicates.map((dup, idx) => (
                                <div key={idx} className="text-sm bg-white p-2 rounded border">
                                    <p className="font-mono font-semibold">{dup.newPart.part_number}</p>
                                    <p className="text-xs text-slate-600">
                                        Existing: {dup.existing.source_name} • {dup.existing.source_details}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Action Selection */}
                        <RadioGroup value={duplicateAction} onValueChange={setDuplicateAction}>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="skip" id="skip" />
                                    <Label htmlFor="skip" className="cursor-pointer flex-1">
                                        <p className="font-medium">Skip Duplicates</p>
                                        <p className="text-xs text-slate-600">
                                            Only save {duplicateData.newParts.length} new part(s), keep existing entries unchanged
                                        </p>
                                    </Label>
                                </div>

                                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="replace" id="replace" />
                                    <Label htmlFor="replace" className="cursor-pointer flex-1">
                                        <p className="font-medium">Replace Duplicates</p>
                                        <p className="text-xs text-slate-600">
                                            Delete existing entries and save all {duplicateData.selectedPartsList.length} part(s) with new data
                                        </p>
                                    </Label>
                                </div>

                                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                    <RadioGroupItem value="manual" id="manual" />
                                    <Label htmlFor="manual" className="cursor-pointer flex-1">
                                        <p className="font-medium">Cancel & Review Manually</p>
                                        <p className="text-xs text-slate-600">
                                            Stop the process and handle duplicates yourself
                                        </p>
                                    </Label>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDuplicateData(null)}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDuplicateResolution}
                        disabled={saving}
                        className="bg-amber-500 hover:bg-amber-600"
                    >
                        {saving ? 'Processing...' : 'Proceed'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}