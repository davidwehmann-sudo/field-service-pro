import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PartVerificationLibrary({ 
    partNumber, 
    onSelect, 
    selectedVerificationId,
    machineModel 
}) {
    const [searchTerm, setSearchTerm] = useState(partNumber || '');

    const { data: verifications = [], isLoading } = useQuery({
        queryKey: ['part-verifications-all'],
        queryFn: async () => {
            return await base44.entities.PartVerification.list('-created_date', 1000);
        },
        staleTime: 60000 // Cache for 1 minute
    });

    const filteredVerifications = verifications.filter(verification => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        const matchesSearch = !searchTerm || 
            verification.part_number?.toLowerCase().includes(lowerSearchTerm) ||
            verification.part_description?.toLowerCase().includes(lowerSearchTerm) ||
            verification.manufacturer?.toLowerCase().includes(lowerSearchTerm) ||
            verification.source_name?.toLowerCase().includes(lowerSearchTerm) ||
            verification.source_details?.toLowerCase().includes(lowerSearchTerm) ||
            verification.technician_notes?.toLowerCase().includes(lowerSearchTerm) ||
            verification.machine_model?.toLowerCase().includes(lowerSearchTerm);

        const matchesMachineModel = !machineModel || verification.machine_model === machineModel;

        return matchesSearch && matchesMachineModel;
    });

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search by part number, description, manufacturer, source, or machine model..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {isLoading && (
                <div className="text-center py-8 text-slate-500">
                    Loading verification library...
                </div>
            )}

            {!isLoading && searchTerm && filteredVerifications.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                    No verifications found for "{searchTerm}"
                    {machineModel && ` on ${machineModel}`}
                </div>
            )}

            {!isLoading && !searchTerm && (
                <div className="text-center py-8 text-slate-400">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Start typing to search verifications</p>
                    <p className="text-xs mt-1">Search by part number, description, manufacturer, source, or machine model</p>
                </div>
            )}

            <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                {filteredVerifications.map((verification) => (
                    <Card 
                        key={verification.id}
                        className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            selectedVerificationId === verification.id && "ring-2 ring-primary"
                        )}
                        onClick={() => onSelect(verification)}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <span className="font-mono">{verification.part_number}</span>
                                        {selectedVerificationId === verification.id && (
                                            <CheckCircle2 className="w-4 h-4 text-primary" />
                                        )}
                                    </CardTitle>
                                    <p className="text-sm text-slate-600 mt-1">
                                        {verification.part_description}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {verification.manufacturer && (
                                    <Badge className="text-xs bg-amber-100 text-amber-800 font-semibold">
                                        {verification.manufacturer}
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                    {verification.source_name}
                                </Badge>
                                {verification.machine_model && (
                                    <Badge className="text-xs bg-blue-100 text-blue-800">
                                        {verification.machine_model}
                                    </Badge>
                                )}
                            </div>
                            
                            <div className="text-sm text-slate-600">
                                <span className="font-medium">Details:</span> {verification.source_details}
                            </div>

                            {verification.technician_notes && (
                                <div className="text-sm text-slate-600 italic">
                                    "{verification.technician_notes}"
                                </div>
                            )}

                            <div className="flex gap-2">
                                {verification.photo_url && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(verification.photo_url, '_blank');
                                        }}
                                    >
                                        <ImageIcon className="w-3 h-3 mr-1" />
                                        View Document
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}