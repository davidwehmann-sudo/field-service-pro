import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Truck, Pencil, Trash2, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';

export default function OwnVehicles() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['ownVehicles'],
    queryFn: () => base44.entities.OwnVehicle.list('-created_date')
  });

  const { data: partsOrders = [] } = useQuery({
    queryKey: ['partsOrders'],
    queryFn: () => base44.entities.PartsOrder.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OwnVehicle.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownVehicles'] });
      setShowForm(false);
      setEditingVehicle(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OwnVehicle.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownVehicles'] });
      setShowForm(false);
      setEditingVehicle(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OwnVehicle.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownVehicles'] });
    }
  });

  const filteredVehicles = vehicles.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.make?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.license_plate?.toLowerCase().includes(search.toLowerCase())
  );

  const getVehiclePartsCost = (vehicleId) => {
    const vehicleParts = partsOrders.filter(p => p.own_vehicle_id === vehicleId);
    return vehicleParts.reduce((total, part) => {
      const partCost = (part.unit_cost || 0) * (part.quantity || 0);
      const laborCost = part.labor_cost || 0;
      return total + partCost + laborCost;
    }, 0);
  };

  const getVehiclePartsCount = (vehicleId) => {
    return partsOrders.filter(p => p.own_vehicle_id === vehicleId).length;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Convert year and mileage to numbers
    if (data.year) data.year = parseInt(data.year);
    if (data.current_mileage) data.current_mileage = parseFloat(data.current_mileage);

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const statusColors = {
    active: "bg-green-100 text-green-700",
    in_maintenance: "bg-yellow-100 text-yellow-700",
    retired: "bg-slate-100 text-slate-700"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Our Vehicles</h1>
          <p className="text-slate-500 mt-1">Track your fleet and maintenance</p>
        </div>
        <Button
          onClick={() => { setEditingVehicle(null); setShowForm(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search vehicles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Vehicles Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {search ? 'No vehicles found' : 'No vehicles yet'}
            </p>
            {!search && (
              <Button
                variant="link"
                className="text-amber-600 mt-2"
                onClick={() => setShowForm(true)}
              >
                Add your first vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{vehicle.name}</h3>
                      <p className="text-sm text-slate-500">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditingVehicle(vehicle); setShowForm(true); }}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setVehicleToDelete(vehicle)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-3">
                  <Badge className={statusColors[vehicle.status]}>
                    {vehicle.status}
                  </Badge>
                  {vehicle.license_plate && (
                    <p className="text-slate-600">
                      License: <span className="font-mono">{vehicle.license_plate}</span>
                    </p>
                  )}
                  {vehicle.current_mileage && (
                    <p className="text-slate-600">
                      Mileage: <span className="font-medium">{vehicle.current_mileage.toLocaleString()}</span> mi
                    </p>
                  )}
                  {vehicle.primary_operator && (
                    <p className="text-slate-600">
                      Operator: <span className="font-medium">{vehicle.primary_operator}</span>
                    </p>
                  )}
                </div>

                {/* Parts & Cost Summary */}
                {getVehiclePartsCount(vehicle.id) > 0 && (
                  <Link to={createPageUrl('PartsOrders') + `?vehicle=${vehicle.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Zap className="w-3 h-3 mr-1" />
                      {getVehiclePartsCount(vehicle.id)} parts • ${getVehiclePartsCost(vehicle.id).toFixed(2)}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vehicle Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Vehicle Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editingVehicle?.name}
                placeholder="Truck 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  required
                  defaultValue={editingVehicle?.year}
                  placeholder="2020"
                />
              </div>
              <div>
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  name="make"
                  required
                  defaultValue={editingVehicle?.make}
                  placeholder="Ford"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  name="model"
                  required
                  defaultValue={editingVehicle?.model}
                  placeholder="F-250"
                />
              </div>
              <div>
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  name="vin"
                  defaultValue={editingVehicle?.vin}
                  placeholder="1FTXX1BT0DFA12345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="license_plate">License Plate</Label>
                <Input
                  id="license_plate"
                  name="license_plate"
                  defaultValue={editingVehicle?.license_plate}
                  placeholder="ABC-1234"
                />
              </div>
              <div>
                <Label htmlFor="current_mileage">Current Mileage</Label>
                <Input
                  id="current_mileage"
                  name="current_mileage"
                  type="number"
                  defaultValue={editingVehicle?.current_mileage}
                  placeholder="125000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="primary_operator">Primary Operator</Label>
              <Input
                id="primary_operator"
                name="primary_operator"
                defaultValue={editingVehicle?.primary_operator}
                placeholder="John Smith"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select defaultValue={editingVehicle?.status || 'active'} name="status">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="in_maintenance">In Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editingVehicle?.notes}
                placeholder="Service history, known issues, etc."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={!!vehicleToDelete}
        onOpenChange={(open) => !open && setVehicleToDelete(null)}
        title="Delete Vehicle?"
        description={getVehiclePartsCount(vehicleToDelete?.id) > 0 ?
          `This vehicle has ${getVehiclePartsCount(vehicleToDelete?.id)} associated maintenance records.` :
          "This vehicle will be permanently deleted."}
        warning={getVehiclePartsCount(vehicleToDelete?.id) > 0 ?
          "⚠️ This vehicle has repair history. Are you sure?" : null}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (vehicleToDelete) {
            deleteMutation.mutate(vehicleToDelete.id);
          }
        }}
      />
    </div>
  );
}