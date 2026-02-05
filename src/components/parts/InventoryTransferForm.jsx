import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export default function InventoryTransferForm({ open, onOpenChange }) {
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [destination, setDestination] = useState('');
  const queryClient = useQueryClient();

  const { data: storageParts = [] } = useQuery({
    queryKey: ['storageInventory'],
    queryFn: async () => {
      const allParts = await base44.entities.PartsInventory.list();
      return allParts.filter(p => p.location === 'storage' && p.quantity_on_hand > 0);
    }
  });

  const transferMutation = useMutation({
    mutationFn: async ({ partId, qty, dest }) => {
      const sourcePart = storageParts.find(p => p.id === partId);
      const moveQty = parseFloat(qty);
      
      // Check if there's already inventory at destination
      const allParts = await base44.entities.PartsInventory.list();
      const destPart = allParts.find(p => 
        p.part_number === sourcePart.part_number && 
        p.location === dest
      );

      if (moveQty >= sourcePart.quantity_on_hand) {
        // Moving everything - just update location
        await base44.entities.PartsInventory.update(partId, {
          location: dest
        });
      } else {
        // Moving partial - update source and create/update destination
        await base44.entities.PartsInventory.update(partId, {
          quantity_on_hand: sourcePart.quantity_on_hand - moveQty
        });

        if (destPart) {
          // Update existing destination record
          await base44.entities.PartsInventory.update(destPart.id, {
            quantity_on_hand: destPart.quantity_on_hand + moveQty
          });
        } else {
          // Create new record at destination
          await base44.entities.PartsInventory.create({
            ...sourcePart,
            id: undefined,
            location: dest,
            quantity_on_hand: moveQty
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storageInventory'] });
      queryClient.invalidateQueries({ queryKey: ['partsInventory'] });
      toast.success('Inventory transferred successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Transfer failed: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!selectedPartId || !quantity || !destination) {
      toast.error('Please fill in all fields');
      return;
    }

    const selectedPart = storageParts.find(p => p.id === selectedPartId);
    const moveQty = parseFloat(quantity);

    if (moveQty > selectedPart.quantity_on_hand) {
      toast.error(`Only ${selectedPart.quantity_on_hand} available in storage`);
      return;
    }

    if (moveQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    transferMutation.mutate({
      partId: selectedPartId,
      qty: quantity,
      dest: destination
    });
  };

  const resetForm = () => {
    setSelectedPartId('');
    setQuantity('');
    setDestination('');
  };

  const selectedPart = storageParts.find(p => p.id === selectedPartId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Transfer Inventory to Truck
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Select Part from Storage *</Label>
            <Select value={selectedPartId} onValueChange={setSelectedPartId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a part..." />
              </SelectTrigger>
              <SelectContent>
                {storageParts.length === 0 && (
                  <div className="p-2 text-sm text-slate-500">No parts in storage</div>
                )}
                {storageParts.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.part_description} - {part.part_number} ({part.quantity_on_hand} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPart && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">Available: <span className="font-semibold text-slate-900">{selectedPart.quantity_on_hand}</span></p>
              {selectedPart.manufacturer && (
                <p className="text-xs text-slate-500 mt-1">Manufacturer: {selectedPart.manufacturer}</p>
              )}
            </div>
          )}

          <div>
            <Label>Quantity to Transfer *</Label>
            <Input
              type="number"
              step="1"
              min="1"
              max={selectedPart?.quantity_on_hand || 999}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="How many to move?"
              required
              disabled={!selectedPartId}
            />
          </div>

          <div>
            <Label>Destination Truck *</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger>
                <SelectValue placeholder="Select your truck..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truck_1">Truck 1</SelectItem>
                <SelectItem value="truck_2">Truck 2</SelectItem>
                <SelectItem value="truck_3">Truck 3</SelectItem>
              </SelectContent>
            </Select>
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
              disabled={transferMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {transferMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                'Transfer'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}