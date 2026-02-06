import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Sparkles, Loader2, X } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function PartsOrderReviewAssistant({ 
  serviceReport, 
  existingParts = [],
  onAddSuggestion,
  autoCheck = false 
}) {
  const [checking, setChecking] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (autoCheck && serviceReport && existingParts.length > 0 && !dismissed) {
      handleReview();
    }
  }, [autoCheck, serviceReport?.id, existingParts.length]);

  const handleReview = async () => {
    if (!serviceReport) {
      toast.error('No service report context available');
      return;
    }

    setChecking(true);
    setSuggestions(null);

    try {
      const context = {
        service: {
          equipment_type: serviceReport.equipment_type,
          equipment_make: serviceReport.equipment_make,
          equipment_model: serviceReport.equipment_model,
          equipment_hours: serviceReport.equipment_hours,
          complaint: serviceReport.complaint,
          work_performed: serviceReport.work_performed
        },
        existing_parts: existingParts.map(p => p.part_description?.toLowerCase() || '')
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a diesel/heavy equipment service assistant. Review the service work and suggest commonly forgotten items.

Context:
${JSON.stringify(context, null, 2)}

Common items that get forgotten:
1. **Supplies Fee**: $35-$150 depending on job complexity (engine work = higher)
2. **Oil**: Engine oil, hydraulic oil, transmission fluid
3. **Filters**: Oil filter, fuel filter, hydraulic filter, air filter
4. **Fluids**: Coolant, DEF (diesel exhaust fluid), brake fluid
5. **Consumables**: Grease, shop supplies

Rules:
- Check existing_parts list - DON'T suggest items already ordered
- Be specific to the equipment type (diesel, hydraulic, etc.)
- Consider the work being done (major repair vs routine service)
- Only suggest high-confidence items that are commonly needed

Return JSON:
{
  "suggestions": [
    {
      "item": "Item name",
      "reason": "Why this is likely needed",
      "confidence": "high" | "medium"
    }
  ]
}

If everything looks covered, return {"suggestions": []}`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  reason: { type: "string" },
                  confidence: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Filter out low confidence and items that match existing parts (more fuzzy)
      const filtered = response.suggestions.filter(s => {
        const itemLower = s.item.toLowerCase();
        const isExisting = existingParts.some(p => {
          const desc = p.part_description?.toLowerCase() || '';
          return desc.includes(itemLower) || itemLower.includes(desc);
        });
        return !isExisting && s.confidence !== 'low';
      });

      setSuggestions(filtered);

      if (filtered.length > 0) {
        toast.info(`💡 ${filtered.length} suggestion${filtered.length > 1 ? 's' : ''} to review`);
      }
    } catch (error) {
      console.error('Review error:', error);
    } finally {
      setChecking(false);
    }
  };

  if (!serviceReport || dismissed) {
    return null;
  }

  if (checking) {
    return (
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Analyzing service work for missing items...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions && suggestions.length === 0) {
    return null;
  }

  if (suggestions && suggestions.length > 0) {
    return (
      <Card className="border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-900">Commonly Forgotten Items</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setDismissed(true)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {suggestions.map((item, idx) => (
                  <div key={idx} className="bg-white border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 mb-1">{item.item}</p>
                        <p className="text-sm text-slate-600">{item.reason}</p>
                      </div>
                      {onAddSuggestion && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onAddSuggestion(item.item);
                            // Remove this suggestion after adding
                            setSuggestions(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">AI Parts Assistant</h3>
            <p className="text-sm text-slate-600 mb-3">
              Check for commonly forgotten items: supplies fees, oil, filters, fluids
            </p>
            <Button
              type="button"
              onClick={handleReview}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Check for Missing Items
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}