import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  BookOpen, 
  Filter, 
  ShoppingCart, 
  Wrench,
  Image as ImageIcon,
  CheckCircle2,
  Plus
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartsLibrary() {
  const [search, setSearch] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
        <Button 
          onClick={() => navigate(createPageUrl('PartsOrders') + '?new=true')}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Custom Part
        </Button>
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

        {(manufacturerFilter !== 'all' || machineFilter !== 'all' || sourceFilter !== 'all' || search) && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Parts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-32 w-full mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
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
              onClick={() => navigate(createPageUrl('PartsOrders') + '?new=true')}
            >
              Add parts using document extraction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVerifications.map((verification) => (
            <Card 
              key={verification.id}
              className="hover:shadow-lg transition-shadow overflow-hidden group"
            >
              {verification.photo_url && (
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  <img 
                    src={verification.photo_url} 
                    alt={verification.part_description}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-600 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>
              )}
              
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <p className="font-mono font-semibold text-slate-900 text-lg">
                      {verification.part_number}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {verification.part_description || 'No description'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {verification.manufacturer && (
                      <Badge variant="outline" className="text-xs">
                        <Wrench className="w-3 h-3 mr-1" />
                        {verification.manufacturer}
                      </Badge>
                    )}
                    {verification.machine_model && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {verification.machine_model}
                      </Badge>
                    )}
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex items-start gap-2 text-xs text-slate-600">
                      <BookOpen className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-700">{verification.source_name}</p>
                        <p className="text-slate-500">{verification.source_details}</p>
                      </div>
                    </div>
                  </div>

                  {verification.technician_notes && (
                    <div className="text-xs text-slate-600 italic border-l-2 border-slate-200 pl-2">
                      {verification.technician_notes}
                    </div>
                  )}

                  <Button
                    onClick={() => handleQuickOrder(verification)}
                    disabled={createOrderMutation.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    size="sm"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Orders
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}