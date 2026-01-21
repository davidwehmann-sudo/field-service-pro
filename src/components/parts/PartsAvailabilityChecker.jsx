import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, MapPin } from "lucide-react";

export default function PartsAvailabilityChecker({ partNumber, partDescription }) {
  const { data: inventory = [] } = useQuery({
    queryKey: ['parts-availability', partNumber],
    queryFn: async () => {
      if (!partNumber) return [];
      return await base44.entities.PartsInventory.filter({ part_number: partNumber });
    },
    enabled: !!partNumber,
  });

  const totalQuantity = inventory.reduce((sum, part) => sum + (part.quantity_on_hand || 0), 0);
  const locations = inventory.filter(p => p.quantity_on_hand > 0);

  if (inventory.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="text-slate-600">Not in stock</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-slate-900">
          {totalQuantity} available
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {locations.map(loc => (
          <Badge key={loc.id} variant="outline" className="text-xs">
            <MapPin className="w-3 h-3 mr-1" />
            {loc.location === 'storage' ? 'Storage' : loc.location.replace('_', ' ').toUpperCase()}: {loc.quantity_on_hand}
          </Badge>
        ))}
      </div>
    </div>
  );
}