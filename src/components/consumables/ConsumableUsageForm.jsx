import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ConsumableUsageForm({ open, onOpenChange }) {
  const [formData, setFormData] = useState({
    item_name: '',
    part_number: '',
    quantity_used: '',
    date_used: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [showNegativeWarning, setShowNegativeWarning] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: consumables = [] } = useQuery({
    queryKey: ['consumableInventory'],
    queryFn: async () => {
      const allParts = await base44.entities.PartsInventory.list();
      return allParts.filter(p => p.category === 'consumable');
    }
  });

  const createUsageMutation = useMutation({
    mutationFn: async (data) => {
      // Create usage record
      await base44.entities.ShopConsumableUsage.create(data);
      
      // Update inventory if part exists (allow negative for items used before check-in)
      if (selectedInventoryItem) {
        const newQuantity = selectedInventoryItem.quantity_on_hand - parseFloat(data.quantity_used);
        await base44.entities.PartsInventory.update(selectedInventoryItem.id, {
          quantity_on_hand: newQuantity
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumableInventory'] });
      toast.success('Consumable usage recorded');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to record usage: ' + error.message);
    }
  });

  const handleInventorySelect = (partId) => {
    const item = consumables.find(p => p.id === partId);
    if (item) {
      setSelectedInventoryItem(item);
      setFormData(prev => ({
        ...prev,
        item_name: item.part_description,
        part_number: item.part_number
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.item_name || !formData.quantity_used) {
      toast.error('Please fill in required fields');
      return;
    }

    const quantityUsed = parseFloat(formData.quantity_used);
    
    // Validate quantity is positive
    if (quantityUsed <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    createUsageMutation.mutate({
      ...formData,
      quantity_used: quantityUsed,
      used_by: user?.full_name || user?.email || 'Unknown'
    });
  };

  // Check for negative inventory warning
  const handleQuantityChange = (value) => {
    setFormData({ ...formData, quantity_used: value });
    
    if (selectedInventoryItem && value) {
      const quantityUsed = parseFloat(value);
      if (quantityUsed > selectedInventoryItem.quantity_on_hand) {
        setShowNegativeWarning(true);
      } else {
        setShowNegativeWarning(false);
      }
    } else {
      setShowNegativeWarning(false);
    }
  };

  const resetForm = () => {
    setFormData({
      item_name: '',
      part_number: '',
      quantity_used: '',
      date_used: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setSelectedInventoryItem(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Shop Consumable Usage</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>From Inventory (Optional)</Label>
            <Select onValueChange={handleInventorySelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select from inventory or enter manually below" />
              </SelectTrigger>
              <SelectContent>
                {consumables.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.part_description} ({item.quantity_on_hand} on hand)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Item Name *</Label>
            <Input
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
              placeholder="e.g., Shop Rags, WD-40, etc."
              required
            />
          </div>

          <div>
            <Label>Part Number</Label>
            <Input
              value={formData.part_number}
              onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label>Quantity Used *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantity_used}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="e.g., 1, 2.5"
              required
            />
            {selectedInventoryItem && (
              <p className="text-xs text-slate-500 mt-1">
                Available: {selectedInventoryItem.quantity_on_hand}
              </p>
            )}
            {showNegativeWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠️ Item used before check-in
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Inventory will show negative qty. Check in item to correct balance.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Date Used</Label>
            <Input
              type="date"
              value={formData.date_used}
              onChange={(e) => setFormData({ ...formData, date_used: e.target.value })}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes about usage"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createUsageMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {createUsageMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Usage'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}