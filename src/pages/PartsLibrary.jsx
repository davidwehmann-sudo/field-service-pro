import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCart } from '@/components/parts/CartContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  BookOpen, 
  Filter, 
  ShoppingCart, 
  Wrench,
  Image as ImageIcon,
  CheckCircle2,
  FileUp,
  Pencil,
  Plus,
  ExternalLink,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import DocumentPartExtractor from '@/components/parts/DocumentPartExtractor';

export default function PartsLibrary() {
  const [search, setSearch] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [editingVerification, setEditingVerification] = useState(null);
  const [showExtractor, setShowExtractor] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedParts, setSelectedParts] = useState(new Set());
  const [previewVerification, setPreviewVerification] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToCart, addMultipleToCart, cartCount } = useCart();

  const { data: verifications = [], isLoading } = useQuery({
    queryKey: ['partVerifications'],
    queryFn: () => base44.entities.PartVerification.list('-created_date')
  });

  const createOrderMutation = useMutation({
    mutationFn: async (verification) => {
      const user = await base44.auth.me();
      return base44.entities.PartsOrder.create({
        assignment_type: 'service_report',
        part_number: verification.part_number,
        part_description: verification.part_description,
        supplier: verification.manufacturer,
        quantity: 1,
        unit_cost: 0,
        status: 'needed',
        verification_source: verification.source_name,
        verification_details: verification.source_details,
        verification_photo_url: verification.photo_url,
        notes: `Added from library - ${verification.machine_model}`,
        service_company: user.current_company || user.company
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partsOrders']);
      toast.success('Part added to orders - remember to set price and assignment');
    }
  });

  const updateVerificationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PartVerification.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['partVerifications']);
      setEditingVerification(null);
      toast.success('Verification updated');
    }
  });

  const uniqueManufacturers = useMemo(() => 
    [...new Set(verifications.map(v => v.manufacturer).filter(Boolean))].sort(),
    [verifications]
  );

  const uniqueMachines = useMemo(() => 
    [...new Set(verifications.map(v => v.machine_model).filter(Boolean))].sort(),
    [verifications]
  );

  const uniqueSources = useMemo(() => 
    [...new Set(verifications.map(v => v.source_name).filter(Boolean))].sort(),
    [verifications]
  );

  const filteredVerifications = useMemo(() => {
    const query = search.toLowerCase();
    
    return verifications.filter(v => {
      const matchesSearch = !search || (
        v.part_number?.toLowerCase().includes(query) ||
        v.part_description?.toLowerCase().includes(query) ||
        v.manufacturer?.toLowerCase().includes(query) ||
        v.machine_model?.toLowerCase().includes(query) ||
        v.source_name?.toLowerCase().includes(query)
      );
      
      const matchesManufacturer = manufacturerFilter === 'all' || v.manufacturer === manufacturerFilter;
      const matchesMachine = machineFilter === 'all' || v.machine_model === machineFilter;
      const matchesSource = sourceFilter === 'all' || v.source_name === sourceFilter;
      
      return matchesSearch && matchesManufacturer && matchesMachine && matchesSource;
    });
  }, [verifications, search, manufacturerFilter, machineFilter, sourceFilter]);

  const handleQuickOrder = (verification) => {
    createOrderMutation.mutate(verification);
  };

  const handleAddToCart = (verification) => {
    addToCart({
      part_number: verification.part_number,
      part_description: verification.part_description,
      manufacturer: verification.manufacturer,
      verification_source: verification.source_name,
      verification_details: verification.source_details,
      verification_photo_url: verification.photo_url,
      supplier: verification.manufacturer,
      unit_cost: 0,
      quantity: 1
    });
    toast.success('Added to cart');
  };

  const handleToggleSelection = (verificationId) => {
    setSelectedParts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(verificationId)) {
        newSet.delete(verificationId);
      } else {
        newSet.add(verificationId);
      }
      return newSet;
    });
  };

  const handleAddSelectedToCart = () => {
    const partsToAdd = filteredVerifications
      .filter(v => selectedParts.has(v.id))
      .map(v => ({
        part_number: v.part_number,
        part_description: v.part_description,
        manufacturer: v.manufacturer,
        verification_source: v.source_name,
        verification_details: v.source_details,
        verification_photo_url: v.photo_url,
        supplier: v.manufacturer,
        unit_cost: 0,
        quantity: 1
      }));
    
    addMultipleToCart(partsToAdd);
    toast.success(`Added ${partsToAdd.length} parts to cart`);
    setMultiSelectMode(false);
    setSelectedParts(new Set());
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewImageUrl(file_url);
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image');
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      part_number: formData.get('part_number'),
      manufacturer: formData.get('manufacturer'),
      source_name: formData.get('source_name'),
      source_details: formData.get('source_details'),
      machine_model: formData.get('machine_model'),
      part_description: formData.get('part_description'),
      technician_notes: formData.get('technician_notes')
    };
    
    // Include new image if uploaded
    if (newImageUrl) {
      data.photo_url = newImageUrl;
    }
    
    updateVerificationMutation.mutate({ id: editingVerification.id, data });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Library</h1>
          <p className="text-slate-500 mt-1">
            Browse {verifications.length} verified parts from manuals and documentation
          </p>
        </div>
        <div className="flex gap-2">
          {cartCount > 0 && (
            <Button 
              onClick={() => navigate(createPageUrl('PartsCart'))}
              variant="outline"
              className="relative"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              View Cart
              <Badge className="ml-2 bg-amber-500">{cartCount}</Badge>
            </Button>
          )}
          <Button 
            onClick={() => setShowExtractor(true)}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <FileUp className="w-4 h-4 mr-2" />
            Upload & Extract
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search by part number, description, manufacturer, machine model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Manufacturer</Label>
            <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {uniqueManufacturers.map(mfr => (
                  <SelectItem key={mfr} value={mfr}>{mfr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Machine Model</Label>
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Machines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Machines</SelectItem>
                {uniqueMachines.map(machine => (
                  <SelectItem key={machine} value={machine}>{machine}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Source</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(manufacturerFilter !== 'all' || machineFilter !== 'all' || sourceFilter !== 'all' || search) && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setManufacturerFilter('all');
                    setMachineFilter('all');
                    setSourceFilter('all');
                    setSearch('');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Clear Filters
                </Button>
                <span className="text-sm text-slate-500">
                  {filteredVerifications.length} {filteredVerifications.length === 1 ? 'part' : 'parts'} found
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {multiSelectMode && selectedParts.size > 0 && (
              <Button 
                onClick={handleAddSelectedToCart}
                className="bg-amber-500 hover:bg-amber-600"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add {selectedParts.size} to Cart
              </Button>
            )}
            <Button
              variant={multiSelectMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMultiSelectMode(!multiSelectMode);
                setSelectedParts(new Set());
              }}
            >
              {multiSelectMode ? 'Done' : 'Multi-Select'}
            </Button>
          </div>
        </div>
      </div>

      {/* Parts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-40 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVerifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search || manufacturerFilter !== 'all' || machineFilter !== 'all' || sourceFilter !== 'all' 
                ? 'No parts found matching your filters' 
                : 'No parts in library yet'}
            </p>
            <Button 
              variant="link" 
              className="text-amber-600 mt-2"
              onClick={() => setShowExtractor(true)}
            >
              Upload document to extract parts
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {multiSelectMode && (
                  <th className="px-4 py-3 w-10"></th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Part</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Manufacturer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Machine</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVerifications.map((verification) => (
                <tr key={verification.id} className="hover:bg-slate-50">
                  {multiSelectMode && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedParts.has(verification.id)}
                        onCheckedChange={() => handleToggleSelection(verification.id)}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {verification.photo_url ? (
                        isPDF(verification.photo_url) ? (
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-red-50 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                            <img 
                              src={verification.photo_url} 
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';
                              }}
                            />
                          </div>
                        )
                      ) : (
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium text-slate-900">
                            {verification.part_number}
                          </p>
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {verification.part_description || 'No description'}
                        </p>
                        {verification.technician_notes && (
                          <p className="text-xs text-slate-500 italic mt-1">
                            {verification.technician_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      <Wrench className="w-3 h-3 mr-1" />
                      {verification.manufacturer || 'N/A'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {verification.machine_model ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {verification.machine_model}
                      </Badge>
                    ) : (
                      <span className="text-sm text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPreviewVerification(verification)}
                      className="text-sm text-left hover:bg-slate-100 p-2 rounded transition-colors"
                    >
                      <p className="font-medium text-green-700 flex items-center gap-1">
                        {verification.source_name}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </p>
                      <p className="text-xs text-slate-500">{verification.source_details}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVerification(verification);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!multiSelectMode && (
                        <Button
                          onClick={() => handleAddToCart(verification)}
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          size="sm"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add to Cart
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingVerification} onOpenChange={(open) => {
        if (!open) {
          setEditingVerification(null);
          setNewImageUrl(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Part Verification</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            {/* Image Upload Section */}
            <div>
              <Label>Verification Image</Label>
              <div className="mt-2 space-y-3">
                {/* Current or New Document Preview */}
                {(newImageUrl || editingVerification?.photo_url) ? (
                  isPDF(newImageUrl || editingVerification?.photo_url) ? (
                    <div className="space-y-2">
                      <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50" style={{ height: '400px' }}>
                        <iframe
                          src={newImageUrl || editingVerification?.photo_url}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                        {newImageUrl && (
                          <Badge className="absolute top-2 right-2 bg-green-600">New File</Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.open(newImageUrl || editingVerification?.photo_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open PDF in New Tab
                      </Button>
                    </div>
                  ) : (
                    <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                      <img 
                        src={newImageUrl || editingVerification?.photo_url}
                        alt="Verification"
                        className="w-full h-auto"
                        onError={(e) => {
                          if (e.target && e.target.parentElement) {
                            e.target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'p-8 text-center text-slate-500';
                            errorDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 text-slate-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><p>Image failed to load</p>';
                            e.target.parentElement.appendChild(errorDiv);
                          }
                        }}
                      />
                      {newImageUrl && (
                        <Badge className="absolute top-2 right-2 bg-green-600">New Image</Badge>
                      )}
                    </div>
                  )
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">No image available</p>
                  </div>
                )}
                
                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*,application/pdf"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload').click()}
                    disabled={uploadingImage}
                    className="w-full"
                  >
                    {uploadingImage ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4 mr-2" />
                        {newImageUrl || editingVerification?.photo_url ? 'Replace Image' : 'Upload Image'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="part_number">Part Number *</Label>
              <Input 
                id="part_number" 
                name="part_number"
                defaultValue={editingVerification?.part_number}
                required
              />
            </div>

            <div>
              <Label htmlFor="part_description">Description</Label>
              <Input 
                id="part_description" 
                name="part_description"
                defaultValue={editingVerification?.part_description}
              />
            </div>

            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input 
                id="manufacturer" 
                name="manufacturer"
                defaultValue={editingVerification?.manufacturer}
                placeholder="e.g., Caterpillar, John Deere, Kubota"
                required
              />
            </div>

            <div>
              <Label htmlFor="machine_model">Machine Model *</Label>
              <Input 
                id="machine_model" 
                name="machine_model"
                defaultValue={editingVerification?.machine_model}
                placeholder="e.g., CAT 416E, JD 310K"
                required
              />
            </div>

            <div>
              <Label htmlFor="source_name">Source Name *</Label>
              <Input 
                id="source_name" 
                name="source_name"
                defaultValue={editingVerification?.source_name}
                placeholder="e.g., Caterpillar SIS, John Deere Parts Catalog"
                required
              />
            </div>

            <div>
              <Label htmlFor="source_details">Source Details *</Label>
              <Textarea 
                id="source_details" 
                name="source_details"
                defaultValue={editingVerification?.source_details}
                placeholder="Page number, section, or URL"
                rows={2}
                required
              />
            </div>

            <div>
              <Label htmlFor="technician_notes">Technician Notes</Label>
              <Textarea 
                id="technician_notes" 
                name="technician_notes"
                defaultValue={editingVerification?.technician_notes}
                placeholder="Additional context or notes"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setEditingVerification(null)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-amber-500 hover:bg-amber-600"
                disabled={updateVerificationMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Source Preview Dialog */}
      <Dialog open={!!previewVerification} onOpenChange={(open) => !open && setPreviewVerification(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verification Source</DialogTitle>
          </DialogHeader>
          
          {previewVerification && (
            <div className="space-y-4">
              {/* Source Info */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-xs text-slate-500">Source Name</Label>
                  <p className="font-medium text-slate-900">{previewVerification.source_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Details</Label>
                  <p className="text-sm text-slate-700">{previewVerification.source_details}</p>
                </div>
                {previewVerification.source_details && 
                 (previewVerification.source_details.startsWith('http://') || 
                  previewVerification.source_details.startsWith('https://')) && (
                  <a 
                    href={previewVerification.source_details}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Link
                  </a>
                )}
              </div>

              {/* Document Preview */}
              {previewVerification.photo_url ? (
                isPDF(previewVerification.photo_url) ? (
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50" style={{ height: '600px' }}>
                      <iframe
                        src={previewVerification.photo_url}
                        className="w-full h-full"
                        title="PDF Preview"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(previewVerification.photo_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open PDF in New Tab
                    </Button>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <img 
                      src={previewVerification.photo_url}
                      alt="Verification document"
                      className="w-full h-auto"
                      onError={(e) => {
                        if (e.target && e.target.parentElement) {
                          e.target.style.display = 'none';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'p-8 text-center text-slate-500';
                          errorDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2 text-slate-300"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><p>Image could not be loaded</p>';
                          e.target.parentElement.appendChild(errorDiv);
                        }
                      }}
                    />
                  </div>
                )
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-12 text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-slate-500">No verification image available</p>
                </div>
              )}

              {/* Part Details */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-xs text-slate-500">Part Number</Label>
                  <p className="font-mono font-medium text-slate-900">{previewVerification.part_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Description</Label>
                  <p className="text-sm text-slate-700">{previewVerification.part_description || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Manufacturer</Label>
                    <p className="text-sm text-slate-700">{previewVerification.manufacturer || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Machine Model</Label>
                    <p className="text-sm text-slate-700">{previewVerification.machine_model || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setPreviewVerification(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Part Extractor */}
      <DocumentPartExtractor
        isOpen={showExtractor}
        onClose={() => setShowExtractor(false)}
        onPartsExtracted={(extractedParts, extractedData, verifications) => {
          queryClient.invalidateQueries(['partVerifications']);
          toast.success(`${extractedParts.length} parts saved to library`);
        }}
      />
    </div>
  );
}