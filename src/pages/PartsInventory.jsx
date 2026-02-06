import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, Camera, Loader2, MapPin, AlertCircle, Sparkles, X, Printer } from "lucide-react";
import { toast } from "sonner";
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';
import PartRelationshipManager from '@/components/parts/PartRelationshipManager';

export default function PartsInventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterManufacturer, setFilterManufacturer] = useState('all');
  const [filterStock, setFilterStock] = useState('all');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [extractingData, setExtractingData] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [partToDelete, setPartToDelete] = useState(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiFilteredParts, setAiFilteredParts] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Block customers from inventory
        if (user.user_type === 'service_customer') {
          navigate(createPageUrl('CustomerPortal'));
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const [formData, setFormData] = useState({
    part_number: '',
    part_description: '',
    manufacturer: '',
    photo_url: '',
    quantity_on_hand: 0,
    location: 'storage',
    unit_cost: '',
    reorder_level: '',
    notes: '',
    cross_compatible_part_numbers: []
  });

  const queryClient = useQueryClient();

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory'],
    queryFn: () => base44.entities.PartsInventory.list('-updated_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PartsInventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-inventory']);
      setShowForm(false);
      resetForm();
      toast.success("Part added to inventory");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PartsInventory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-inventory']);
      setShowForm(false);
      resetForm();
      toast.success("Part updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PartsInventory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['parts-inventory']);
      toast.success("Part removed");
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, photo_url: file_url }));

      // Extract part info from photo
      setExtractingData(true);
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this image of a part or SKU tag and extract the following information:
- Part Number (manufacturer's part number)
- Description (what the part is)
- Manufacturer name

Return the data in the specified JSON format. If you cannot identify something, use "Unknown" or leave it empty.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            part_number: { type: "string" },
            part_description: { type: "string" },
            manufacturer: { type: "string" }
          }
        }
      });

      setFormData(prev => ({
        ...prev,
        part_number: response.part_number || prev.part_number,
        part_description: response.part_description || prev.part_description,
        manufacturer: response.manufacturer || prev.manufacturer,
      }));
      
      toast.success("Part info extracted from photo");
    } catch (error) {
      toast.error("Failed to process photo");
    } finally {
      setUploadingPhoto(false);
      setExtractingData(false);
    }
  };

  const handleSave = () => {
    // Check for duplicate part number when creating new part
    if (!editingPart) {
      const duplicate = inventory.find(p => 
        p.part_number?.toLowerCase() === formData.part_number?.toLowerCase()
      );
      if (duplicate) {
        toast.error(`Part ${formData.part_number} already exists in inventory`);
        return;
      }
    }

    const data = {
      ...formData,
      quantity_on_hand: parseInt(formData.quantity_on_hand) || 0,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
      reorder_level: formData.reorder_level ? parseInt(formData.reorder_level) : null,
    };

    // If editing and part number changed, add old part number to cross-compatible list
    if (editingPart && editingPart.part_number !== formData.part_number) {
      const crossCompat = formData.cross_compatible_part_numbers || [];
      if (!crossCompat.some(cpn => cpn.trim().toLowerCase() === editingPart.part_number.trim().toLowerCase())) {
        data.cross_compatible_part_numbers = [...crossCompat, editingPart.part_number];
      }
    }

    if (editingPart) {
      updateMutation.mutate({ id: editingPart.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (part) => {
    setEditingPart(part);
    setFormData({
      part_number: part.part_number || '',
      part_description: part.part_description || '',
      manufacturer: part.manufacturer || '',
      photo_url: part.photo_url || '',
      quantity_on_hand: part.quantity_on_hand || 0,
      location: part.location || 'storage',
      unit_cost: part.unit_cost || '',
      reorder_level: part.reorder_level || '',
      notes: part.notes || '',
      cross_compatible_part_numbers: part.cross_compatible_part_numbers || []
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      part_number: '',
      part_description: '',
      manufacturer: '',
      photo_url: '',
      quantity_on_hand: 0,
      location: 'storage',
      unit_cost: '',
      reorder_level: '',
      notes: '',
      cross_compatible_part_numbers: []
    });
    setEditingPart(null);
  };

  const uniqueManufacturers = useMemo(() => 
    [...new Set(inventory.map(p => p.manufacturer).filter(Boolean))].sort(),
    [inventory]
  );

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) {
      setAiFilteredParts(null);
      return;
    }

    setAiProcessing(true);
    try {
      // Only send essential fields to reduce token usage
      const compactInventory = inventory.map(p => ({
        id: p.id,
        pn: p.part_number || 'N/A',
        desc: p.part_description,
        mfr: p.manufacturer || 'Unknown',
        qty: p.quantity_on_hand,
        loc: p.location
      }));

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a parts catalog expert. Given this search query: "${aiQuery}"

Find matching parts from this inventory (ID | Part# | Description | Manufacturer | Stock | Location):
${compactInventory.map(p => `${p.id} | ${p.pn} | ${p.desc} | ${p.mfr} | ${p.qty} | ${p.loc}`).join('\n')}

CRITICAL DOMAIN KNOWLEDGE - Apply semantic understanding:
- SEALS: includes O-rings, gaskets, seals, packing, weather stripping
- FILTERS: oil filters, air filters, fuel filters, hydraulic filters, cabin filters
- BELTS: serpentine belts, timing belts, V-belts, drive belts
- BEARINGS: ball bearings, roller bearings, bushings, sleeves
- HOSES: hydraulic hoses, fuel lines, coolant hoses, air lines
- FASTENERS: bolts, screws, nuts, washers, clips
- FLUIDS: oil, coolant, hydraulic fluid, grease, lubricants

Brand equivalents:
- Cat = Caterpillar
- JD = John Deere
- Kubota, Komatsu, Case, etc.

Stock levels:
- "out of stock" or "empty" = 0
- "low stock" = at or below reorder level
- "in stock" or "available" = quantity > 0

Be VERY LIBERAL with matches - if the query could reasonably relate to a part, include it.

Return the IDs of ALL matching parts.`,
        response_json_schema: {
          type: "object",
          properties: {
            part_ids: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const matchedParts = inventory.filter(p => response.part_ids.includes(p.id));
      setAiFilteredParts(matchedParts);
      toast.success(`Found ${matchedParts.length} parts`);
    } catch (error) {
      toast.error('AI search failed');
    } finally {
      setAiProcessing(false);
    }
  };

  const filteredInventory = useMemo(() => {
    const baseList = aiFilteredParts || inventory;
    const lowerQuery = searchQuery.toLowerCase();
    
    return baseList.filter(part => {
      const matchesSearch = !searchQuery || (
        part.part_number?.toLowerCase().includes(lowerQuery) ||
        part.part_description?.toLowerCase().includes(lowerQuery) ||
        part.manufacturer?.toLowerCase().includes(lowerQuery)
      );
      
      const matchesLocation = filterLocation === 'all' || part.location === filterLocation;
      const matchesManufacturer = filterManufacturer === 'all' || part.manufacturer === filterManufacturer;
      
      const matchesStock = filterStock === 'all' || (
        filterStock === 'low' ? (part.reorder_level && part.quantity_on_hand <= part.reorder_level) :
        filterStock === 'out' ? part.quantity_on_hand === 0 :
        filterStock === 'in' ? part.quantity_on_hand > 0 : true
      );
      
      return matchesSearch && matchesLocation && matchesManufacturer && matchesStock;
    });
  }, [inventory, aiFilteredParts, searchQuery, filterLocation, filterManufacturer, filterStock]);

  const locationLabels = {
    storage: 'Storage',
    truck_1: 'Truck 1',
    truck_2: 'Truck 2',
    truck_3: 'Truck 3',
    non_stock: 'Non-Stock'
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-table { display: table !important; width: 100%; }
          .print-title { margin-bottom: 20px; }
          body { padding: 20px; }
        }
      `}</style>
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 print-title">Parts Inventory</h1>
            <p className="text-sm text-slate-500 no-print">Track parts in storage and on service trucks</p>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Part
            </Button>
          </div>
        </div>

      <div className="space-y-4 no-print">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <Label className="text-sm font-medium text-purple-900">AI Smart Search</Label>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Try: 'filters for Caterpillar' or 'low stock items on Truck 1'"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAiSearch()}
              className="bg-white"
            />
            <Button 
              onClick={handleAiSearch}
              disabled={aiProcessing || !aiQuery.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {aiProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
            {aiFilteredParts && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setAiFilteredParts(null);
                  setAiQuery('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {aiFilteredParts && (
            <p className="text-xs text-purple-700 mt-2">
              AI found {aiFilteredParts.length} matching parts
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1">Location</Label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="truck_1">Truck 1</SelectItem>
                <SelectItem value="truck_2">Truck 2</SelectItem>
                <SelectItem value="truck_3">Truck 3</SelectItem>
                <SelectItem value="non_stock">Non-Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-slate-500 mb-1">Manufacturer</Label>
            <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
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
            <Label className="text-xs text-slate-500 mb-1">Stock Level</Label>
            <Select value={filterStock} onValueChange={setFilterStock}>
              <SelectTrigger>
                <SelectValue placeholder="All Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(filterLocation !== 'all' || filterManufacturer !== 'all' || filterStock !== 'all') && (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setFilterLocation('all');
                setFilterManufacturer('all');
                setFilterStock('all');
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear Filters
            </Button>
            <span className="text-sm text-slate-500">
              {filteredInventory.length} {filteredInventory.length === 1 ? 'part' : 'parts'} found
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full print-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Part #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Manufacturer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInventory.map(part => {
                const isLowStock = part.reorder_level && part.quantity_on_hand <= part.reorder_level;
                return (
                  <tr key={part.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{part.part_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{part.part_description}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{part.manufacturer || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {part.quantity_on_hand}
                        {isLowStock && ' ⚠️'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{locationLabels[part.location]}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {part.unit_cost ? `$${part.unit_cost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right no-print">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(part)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setPartToDelete(part)}
                          className="text-red-500"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      {filteredInventory.length === 0 && !isLoading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400">No parts found</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPart ? 'Edit Part' : 'Add New Part'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Part Photo</Label>
              <div className="mt-2">
                {formData.photo_url ? (
                  <div className="relative">
                    <img src={formData.photo_url} alt="Part" className="w-full h-48 object-cover rounded-lg" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                      className="absolute top-2 right-2"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                    <div className="flex flex-col items-center">
                      {uploadingPhoto || extractingData ? (
                        <>
                          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-2" />
                          <p className="text-sm text-slate-500">
                            {extractingData ? 'Extracting part info...' : 'Uploading...'}
                          </p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-8 h-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-500">Upload part or SKU tag photo</p>
                          <p className="text-xs text-slate-400 mt-1">AI will extract part info</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto || extractingData}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Part Number *</Label>
                <Input
                  value={formData.part_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, part_number: e.target.value }))}
                  placeholder="12345-ABC"
                />
              </div>
              <div>
                <Label>Manufacturer</Label>
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                  placeholder="Caterpillar"
                />
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.part_description}
                onChange={(e) => setFormData(prev => ({ ...prev, part_description: e.target.value }))}
                placeholder="Fuel filter assembly"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity_on_hand}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity_on_hand: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorder_level: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            <div>
              <Label>Location</Label>
              <Select value={formData.location} onValueChange={(val) => setFormData(prev => ({ ...prev, location: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Storage</SelectItem>
                  <SelectItem value="truck_1">Truck 1</SelectItem>
                  <SelectItem value="truck_2">Truck 2</SelectItem>
                  <SelectItem value="truck_3">Truck 3</SelectItem>
                  <SelectItem value="non_stock">Non-Stock (Order as Needed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cross-Compatible Part Numbers</Label>
              <p className="text-xs text-slate-500 mb-2">Alternative manufacturer part numbers that work with this part</p>
              <div className="space-y-2">
                {formData.cross_compatible_part_numbers.map((cpn, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={cpn}
                      onChange={(e) => {
                        const updated = [...formData.cross_compatible_part_numbers];
                        updated[idx] = e.target.value;
                        setFormData(prev => ({ ...prev, cross_compatible_part_numbers: updated }));
                      }}
                      placeholder="Alternative part number"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updated = formData.cross_compatible_part_numbers.filter((_, i) => i !== idx);
                        setFormData(prev => ({ ...prev, cross_compatible_part_numbers: updated }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      cross_compatible_part_numbers: [...prev.cross_compatible_part_numbers, ''] 
                    }));
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Alternative Number
                </Button>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {editingPart && (
              <div className="border-t pt-4">
                <PartRelationshipManager 
                  partNumber={formData.part_number}
                  onUpdate={() => queryClient.invalidateQueries(['parts-inventory'])}
                />
              </div>
            )}

            <div className="flex justify-between items-center gap-3">
              {!editingPart && formData.part_description && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      location: 'non_stock',
                      quantity_on_hand: 0
                    }));
                    toast.success('Set to non-stock catalog item');
                  }}
                  className="text-blue-600"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Mark as Non-Stock
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={!formData.part_number || !formData.part_description}
                >
                  {editingPart ? 'Update' : 'Add'} Part
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!partToDelete}
        onOpenChange={(open) => !open && setPartToDelete(null)}
        title="Remove Part from Inventory?"
        description={`Remove "${partToDelete?.part_description || partToDelete?.part_number}"?`}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (partToDelete) {
            deleteMutation.mutate(partToDelete.id);
          }
        }}
      />
      </div>
    </>
  );
}