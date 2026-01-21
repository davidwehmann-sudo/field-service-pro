import React, { useState, useEffect } from 'react';
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
import { Plus, Search, Package, Camera, Loader2, MapPin, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PartsInventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [filterLocation, setFilterLocation] = useState('all');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [extractingData, setExtractingData] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Block customers
        if (user.user_type === 'customer') {
          navigate(createPageUrl('Home'));
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
    notes: ''
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
    const data = {
      ...formData,
      quantity_on_hand: parseInt(formData.quantity_on_hand) || 0,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
      reorder_level: formData.reorder_level ? parseInt(formData.reorder_level) : null,
    };

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
      notes: part.notes || ''
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
      notes: ''
    });
    setEditingPart(null);
  };

  const filteredInventory = inventory.filter(part => {
    const matchesSearch = 
      part.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.part_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      part.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLocation = filterLocation === 'all' || part.location === filterLocation;
    
    return matchesSearch && matchesLocation;
  });

  const locationLabels = {
    storage: 'Storage',
    truck_1: 'Truck 1',
    truck_2: 'Truck 2',
    truck_3: 'Truck 3'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parts Inventory</h1>
          <p className="text-sm text-slate-500">Track parts in storage and on service trucks</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Part
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
            <SelectItem value="truck_1">Truck 1</SelectItem>
            <SelectItem value="truck_2">Truck 2</SelectItem>
            <SelectItem value="truck_3">Truck 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInventory.map(part => {
          const isLowStock = part.reorder_level && part.quantity_on_hand <= part.reorder_level;
          
          return (
            <Card key={part.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                {part.photo_url && (
                  <img 
                    src={part.photo_url} 
                    alt={part.part_description}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{part.part_number}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2">{part.part_description}</p>
                  </div>
                </div>

                {part.manufacturer && (
                  <p className="text-xs text-slate-400 mb-2">{part.manufacturer}</p>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={isLowStock ? "destructive" : "default"}>
                      {part.quantity_on_hand} in stock
                    </Badge>
                    {isLowStock && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {locationLabels[part.location]}
                  </Badge>
                </div>

                {part.unit_cost && (
                  <p className="text-sm text-slate-600 mb-3">
                    Cost: ${part.unit_cost.toFixed(2)}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(part)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      if (confirm('Remove this part from inventory?')) {
                        deleteMutation.mutate(part.id);
                      }
                    }}
                    className="text-red-500"
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}