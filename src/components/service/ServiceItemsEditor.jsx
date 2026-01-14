import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, DollarSign } from "lucide-react";

const DEFAULT_ITEMS = [
  { description: 'Diagnostic/Troubleshooting', hours: '', rate: '125', total: 0 },
  { description: 'Repair Labor', hours: '', rate: '115', total: 0 },
  { description: 'PM Service', hours: '', rate: '95', total: 0 },
];

export default function ServiceItemsEditor({ items = [], onChange }) {
  const serviceItems = items.length > 0 ? items : [];

  const addItem = (preset = null) => {
    const newItem = preset || { description: '', hours: '', rate: '115', total: 0 };
    onChange([...serviceItems, newItem]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...serviceItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total
    const hours = parseFloat(updated[index].hours) || 0;
    const rate = parseFloat(updated[index].rate) || 0;
    updated[index].total = hours * rate;
    
    onChange(updated);
  };

  const removeItem = (index) => {
    onChange(serviceItems.filter((_, i) => i !== index));
  };

  const totalAmount = serviceItems.reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-slate-500 mr-2">Quick add:</span>
        {DEFAULT_ITEMS.map((item, idx) => (
          <Button
            key={idx}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addItem({ ...item })}
            className="text-xs"
          >
            + {item.description}
          </Button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {serviceItems.map((item, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="flex-1">
              <Input
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                placeholder="Service description"
                className="bg-white"
              />
            </div>
            <div className="w-20">
              <Input
                type="number"
                step="0.25"
                value={item.hours}
                onChange={(e) => updateItem(index, 'hours', e.target.value)}
                placeholder="Hrs"
                className="bg-white text-center"
              />
            </div>
            <div className="text-slate-400">×</div>
            <div className="w-24">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  value={item.rate}
                  onChange={(e) => updateItem(index, 'rate', e.target.value)}
                  className="bg-white pl-7"
                />
              </div>
            </div>
            <div className="text-slate-400">=</div>
            <div className="w-24 text-right font-semibold text-slate-900">
              ${(item.total || 0).toFixed(2)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              className="text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {serviceItems.length === 0 && (
          <div className="text-center py-6 text-slate-400 border-2 border-dashed rounded-lg">
            No service items added. Use quick add buttons or add custom item.
          </div>
        )}
      </div>

      {/* Add Custom Button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => addItem()}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Custom Service Item
      </Button>

      {/* Total */}
      {serviceItems.length > 0 && (
        <div className="flex justify-end items-center gap-4 pt-4 border-t">
          <span className="text-slate-500">Service Items Total:</span>
          <span className="text-xl font-bold text-slate-900 flex items-center">
            <DollarSign className="w-5 h-5" />
            {totalAmount.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}