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
    const [bypassMachineModel, setBypassMachineModel] = useState(false);
    const [saving, setSaving] = useState(false);

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
            
            // Save all selected parts to PartVerification entity
            const verifications = selectedPartsList.map(part => ({
                part_number: part.part_number,
                part_description: part.part_description,
                manufacturer: part.manufacturer || extractedData.manufacturer,
                source_name: extractedData.source_name,
                source_details: part.source_details,
                photo_url: extractedData.photo_url,
                machine_model: bypassMachineModel ? 'N/A' : machineModel,
                service_company: user.current_company || user.company
            }));

            await base44.entities.PartVerification.bulkCreate(verifications);

            toast.success(`Saved ${verifications.length} parts to verification library`);
            
            // Pass back to parent for immediate use
            if (onPartsExtracted) {
                onPartsExtracted(selectedPartsList, extractedData, verifications);
            }
            
            // Reset and close
            setExtractedData(null);
            setSelectedParts({});
            onClose();
        } catch (error) {
            toast.error('Error saving to library: ' + error.message);
        } finally {
            setSaving(false);
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Extract Parts from Document</DialogTitle>
                    <DialogDescription>
                        Upload a parts diagram, manual, or invoice to automatically extract part information
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
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
                                            Save {selectedCount} to Library & Use
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}