import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    GitBranch, 
    ArrowRight, 
    RefreshCw, 
    TrendingUp, 
    Plus, 
    Trash2,
    Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

const relationshipIcons = {
    substitution: GitBranch,
    supersession: RefreshCw,
    upgrade: TrendingUp
};

const relationshipLabels = {
    substitution: 'Substitution',
    supersession: 'Supersession',
    upgrade: 'Upgrade'
};

const relationshipDescriptions = {
    substitution: 'Interchangeable parts (can use either)',
    supersession: 'Newer version replaces old',
    upgrade: 'Improved/enhanced version'
};

export default function PartRelationshipManager({ partNumber, onUpdate }) {
    const [showForm, setShowForm] = useState(false);
    const [newRelationship, setNewRelationship] = useState({
        to_part_number: '',
        relationship_type: 'substitution',
        notes: ''
    });

    const queryClient = useQueryClient();

    const { data: relationships = [], isLoading } = useQuery({
        queryKey: ['part-relationships', partNumber],
        queryFn: async () => {
            const outgoing = await base44.entities.PartRelationship.filter({ from_part_number: partNumber });
            const incoming = await base44.entities.PartRelationship.filter({ to_part_number: partNumber });
            return { outgoing, incoming };
        },
        enabled: !!partNumber
    });

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const user = await base44.auth.me();
            return base44.entities.PartRelationship.create({
                ...data,
                from_part_number: partNumber,
                service_company: user.current_company || user.company
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['part-relationships']);
            toast.success('Relationship added');
            setShowForm(false);
            setNewRelationship({ to_part_number: '', relationship_type: 'substitution', notes: '' });
            if (onUpdate) onUpdate();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.PartRelationship.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['part-relationships']);
            toast.success('Relationship removed');
            if (onUpdate) onUpdate();
        }
    });

    const handleAdd = () => {
        if (!newRelationship.to_part_number.trim()) {
            toast.error('Enter a part number');
            return;
        }
        if (newRelationship.to_part_number.toLowerCase() === partNumber.toLowerCase()) {
            toast.error('Cannot relate a part to itself');
            return;
        }
        createMutation.mutate(newRelationship);
    };

    if (!partNumber) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">Part Relationships</h3>
                    <p className="text-xs text-slate-500">Substitutions, supersessions, and upgrades</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(!showForm)}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                </Button>
            </div>

            {showForm && (
                <Card className="border-2 border-primary">
                    <CardContent className="p-4 space-y-3">
                        <div>
                            <Label className="text-xs">Related Part Number *</Label>
                            <Input
                                value={newRelationship.to_part_number}
                                onChange={(e) => setNewRelationship(prev => ({ ...prev, to_part_number: e.target.value }))}
                                placeholder="Enter part number"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Relationship Type *</Label>
                            <Select
                                value={newRelationship.relationship_type}
                                onValueChange={(val) => setNewRelationship(prev => ({ ...prev, relationship_type: val }))}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(relationshipLabels).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            <div className="flex flex-col">
                                                <span>{label}</span>
                                                <span className="text-xs text-slate-500">{relationshipDescriptions[key]}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Notes (optional)</Label>
                            <Textarea
                                value={newRelationship.notes}
                                onChange={(e) => setNewRelationship(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="e.g., 'Use for older models' or 'Better flow rate'"
                                rows={2}
                                className="mt-1"
                            />
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowForm(false);
                                    setNewRelationship({ to_part_number: '', relationship_type: 'substitution', notes: '' });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleAdd}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Add Relationship'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="text-center py-4">
                    <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-2">
                    {relationships.outgoing?.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-700">This part relates to:</p>
                            {relationships.outgoing.map((rel) => {
                                const Icon = relationshipIcons[rel.relationship_type];
                                return (
                                    <Card key={rel.id} className="border-l-4 border-l-blue-500">
                                        <CardContent className="p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className="w-4 h-4 text-blue-600" />
                                                        <span className="font-mono font-semibold text-slate-900">
                                                            {rel.to_part_number}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {relationshipLabels[rel.relationship_type]}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-mono">{partNumber}</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                        <span className="font-mono">{rel.to_part_number}</span>
                                                    </div>
                                                    {rel.notes && (
                                                        <p className="text-xs text-slate-600 mt-1 italic">{rel.notes}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteMutation.mutate(rel.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {relationships.incoming?.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <p className="text-xs font-medium text-slate-700">Other parts that relate to this:</p>
                            {relationships.incoming.map((rel) => {
                                const Icon = relationshipIcons[rel.relationship_type];
                                return (
                                    <Card key={rel.id} className="border-l-4 border-l-amber-500">
                                        <CardContent className="p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className="w-4 h-4 text-amber-600" />
                                                        <span className="font-mono font-semibold text-slate-900">
                                                            {rel.from_part_number}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {relationshipLabels[rel.relationship_type]}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span className="font-mono">{rel.from_part_number}</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                        <span className="font-mono">{partNumber}</span>
                                                    </div>
                                                    {rel.notes && (
                                                        <p className="text-xs text-slate-600 mt-1 italic">{rel.notes}</p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteMutation.mutate(rel.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {relationships.outgoing?.length === 0 && relationships.incoming?.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">
                            No relationships defined yet
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}