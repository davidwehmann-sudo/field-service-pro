import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Car, AlertTriangle } from "lucide-react";

const LOCATION_CONDITIONS = [
  { value: 'standard', label: 'Standard Access', description: 'Normal job site', surcharge: 0 },
  { value: 'remote', label: 'Remote Location', description: 'Extended distance from service area', surcharge: 75 },
  { value: 'difficult_access', label: 'Difficult Access', description: 'Rough terrain, tight spaces, special equipment needed', surcharge: 100 },
  { value: 'hazardous', label: 'Hazardous Conditions', description: 'Confined space, high risk environment', surcharge: 150 },
];

export default function DestinationFeeEditor({ fee = {}, onChange }) {
  const [dieselPrice, setDieselPrice] = useState(null);
  const [dieselPeriod, setDieselPeriod] = useState(null);
  const [loadingDiesel, setLoadingDiesel] = useState(false);

  useEffect(() => {
    const fetchDiesel = async () => {
      setLoadingDiesel(true);
      try {
        const res = await base44.functions.invoke('getDieselPrice', {});
        if (res.data?.price) {
          setDieselPrice(res.data.price);
          setDieselPeriod(res.data.period);
          // Auto-populate if not already set
          if (!fee.diesel_price_per_gallon) {
            onChange({ ...fee, diesel_price_per_gallon: res.data.price, fuel_surcharge_percent: fee.fuel_surcharge_percent ?? 15 });
          }
        }
      } catch (e) {
        console.error('Failed to fetch diesel price', e);
      } finally {
        setLoadingDiesel(false);
      }
    };
    fetchDiesel();
  }, []);

  const handleChange = (field, value) => {
    const updated = { ...fee, [field]: value };
    
    // Auto-set condition surcharge when condition changes
    if (field === 'location_condition') {
      const condition = LOCATION_CONDITIONS.find(c => c.value === value);
      updated.condition_surcharge = condition?.surcharge || 0;
    }
    
    // Recalculate total
    const mileageTotal = (parseFloat(updated.mileage) || 0) * (parseFloat(updated.mileage_rate) || 0);
    const fuelSurcharge = mileageTotal * ((parseFloat(updated.fuel_surcharge_percent) || 0) / 100);
    const travelTimeTotal = (parseFloat(updated.travel_hours) || 0) * (parseFloat(updated.travel_rate) || 0);
    const conditionSurcharge = parseFloat(updated.condition_surcharge) || 0;
    updated.fuel_surcharge_amount = fuelSurcharge;
    updated.total = mileageTotal + fuelSurcharge + travelTimeTotal + conditionSurcharge;

    onChange(updated);
  };

  const mileageTotal = (parseFloat(fee.mileage) || 0) * (parseFloat(fee.mileage_rate) || 0);
  const fuelSurchargeAmount = mileageTotal * ((parseFloat(fee.fuel_surcharge_percent) || 0) / 100);
  const travelTimeTotal = (parseFloat(fee.travel_hours) || 0) * (parseFloat(fee.travel_rate) || 0);
  const conditionSurcharge = parseFloat(fee.condition_surcharge) || 0;
  const total = mileageTotal + fuelSurchargeAmount + travelTimeTotal + conditionSurcharge;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Destination Fee
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mileage */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-slate-600">
            <Car className="w-4 h-4" />
            Mileage
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[140px]">
              <Input
                type="number"
                step="0.1"
                value={fee.mileage || ''}
                onChange={(e) => handleChange('mileage', e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Round trip miles</p>
            </div>
            <span className="text-slate-400">×</span>
            <div className="w-24">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={fee.mileage_rate || ''}
                  onChange={(e) => handleChange('mileage_rate', e.target.value)}
                  placeholder="0.65"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Per mile</p>
            </div>
            <span className="text-slate-400">=</span>
            <div className="w-24 text-right font-medium">
              ${mileageTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Fuel Surcharge */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-slate-600">
            <span>⛽</span>
            Fuel Surcharge
          </Label>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            {loadingDiesel ? (
              <p className="text-amber-700 text-xs">Fetching current diesel price...</p>
            ) : dieselPrice ? (
              <p className="text-amber-800">
                EIA U.S. Avg Diesel: <span className="font-bold">${dieselPrice.toFixed(3)}/gal</span>
                {dieselPeriod && <span className="text-amber-600 text-xs ml-2">(week of {dieselPeriod})</span>}
              </p>
            ) : (
              <p className="text-amber-700 text-xs">Could not load live diesel price — enter manually below</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[160px]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  step="0.001"
                  value={fee.diesel_price_per_gallon || ''}
                  onChange={(e) => handleChange('diesel_price_per_gallon', e.target.value)}
                  placeholder={dieselPrice?.toFixed(3) || '0.000'}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Diesel price/gal</p>
            </div>
            <span className="text-slate-400">×</span>
            <div className="w-24">
              <div className="relative">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={fee.fuel_surcharge_percent ?? 15}
                  onChange={(e) => handleChange('fuel_surcharge_percent', e.target.value)}
                  placeholder="15"
                  className="pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Surcharge %</p>
            </div>
            <span className="text-slate-400">=</span>
            <div className="w-24 text-right font-medium">
              ${fuelSurchargeAmount.toFixed(2)}
            </div>
          </div>
          <p className="text-xs text-slate-500">Applied as % of mileage subtotal (${mileageTotal.toFixed(2)})</p>
        </div>

        {/* Travel Time */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-slate-600">
            <Clock className="w-4 h-4" />
            Travel Time
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[140px]">
              <Input
                type="number"
                step="0.25"
                value={fee.travel_hours || ''}
                onChange={(e) => handleChange('travel_hours', e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-slate-400 mt-1">Total hours</p>
            </div>
            <span className="text-slate-400">×</span>
            <div className="w-24">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  value={fee.travel_rate || ''}
                  onChange={(e) => handleChange('travel_rate', e.target.value)}
                  placeholder="75"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Per hour</p>
            </div>
            <span className="text-slate-400">=</span>
            <div className="w-24 text-right font-medium">
              ${travelTimeTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Location Conditions */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-slate-600">
            <AlertTriangle className="w-4 h-4" />
            Location Conditions
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                value={fee.location_condition || 'standard'}
                onValueChange={(val) => handleChange('location_condition', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_CONDITIONS.map((condition) => (
                    <SelectItem key={condition.value} value={condition.value}>
                      <div>
                        <p className="font-medium">{condition.label}</p>
                        <p className="text-xs text-slate-500">{condition.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <Input
                  type="number"
                  value={fee.condition_surcharge || ''}
                  onChange={(e) => handleChange('condition_surcharge', e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Surcharge</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-4 border-t bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <span className="text-slate-600 font-medium">Destination Fee Total:</span>
          <span className="text-xl font-bold text-slate-900">${total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}