import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function InvoiceReviewAssistant({ invoice, serviceReport, partsOrders, onAddSuggestion }) {
  const [checking, setChecking] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [checked, setChecked] = useState(false);

  const handleReview = async () => {
    setChecking(true);
    setSuggestions(null);
    setChecked(false);

    try {
      // Build context for AI
      const context = {
        invoice: {
          labor_total: invoice.labor_total || 0,
          travel_total: invoice.travel_total || 0,
          parts_total: invoice.parts_total || 0,
          status: invoice.status
        },
        service: serviceReport ? {
          equipment_type: serviceReport.equipment_type,
          equipment_make: serviceReport.equipment_make,
          equipment_model: serviceReport.equipment_model,
          work_performed: serviceReport.work_performed,
          complaint: serviceReport.complaint
        } : null,
        parts: partsOrders.map(p => ({
          description: p.part_description,
          quantity: p.quantity,
          part_number: p.part_number
        }))
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a diesel equipment service invoice reviewer. Analyze this invoice and identify potentially missing charges.

Context:
${JSON.stringify(context, null, 2)}

Common items to check:
1. **Supplies Fee**: Starting at $35, can be much higher for major jobs (engine overhauls, major repairs)
2. **Oil/Fluids**: Engine oil, hydraulic oil, coolant, DEF fluid
3. **Filters**: Oil filters, fuel filters, hydraulic filters, air filters
4. **Consumables**: Grease, shop rags, absorbents, solvents

Guidelines:
- If major work was done (engine overhaul, transmission, hydraulic system), suggest $75-$150 supplies fee
- For routine service, suggest $35-$50 supplies fee
- If equipment type mentions diesel/hydraulic, consider oil and filters
- Look at work_performed and complaint for clues about what was done

Return a JSON object with this structure:
{
  "missing_items": [
    {
      "item": "Item name",
      "reason": "Why this might be missing",
      "suggested_amount": 50.00,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "Brief overall assessment"
}

If everything looks good, return {"missing_items": [], "notes": "Invoice looks complete"}`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            missing_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  reason: { type: "string" },
                  suggested_amount: { type: "number" },
                  confidence: { type: "string" }
                }
              }
            },
            notes: { type: "string" }
          }
        }
      });

      setSuggestions(response);
      setChecked(true);

      if (response.missing_items.length === 0) {
        toast.success('Invoice looks complete!');
      } else {
        toast.info(`Found ${response.missing_items.length} suggestion${response.missing_items.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      console.error('Review error:', error);
      toast.error('Failed to review invoice');
    } finally {
      setChecking(false);
    }
  };

  if (!serviceReport && (!partsOrders || partsOrders.length === 0)) {
    return null; // Don't show if no context available
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">AI Invoice Review</h3>
            <p className="text-sm text-slate-600 mb-3">
              Check for missing supplies fees, oil, filters, and consumables before finalizing
            </p>

            {!checked && (
              <Button
                type="button"
                onClick={handleReview}
                disabled={checking}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Review Invoice
                  </>
                )}
              </Button>
            )}

            {checked && suggestions && (
              <div className="space-y-3">
                {suggestions.missing_items.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">{suggestions.notes}</span>
                  </div>
                ) : (
                  <>
                    {suggestions.missing_items.map((item, idx) => (
                      <div key={idx} className="bg-white border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <AlertCircle className={`w-4 h-4 ${
                                item.confidence === 'high' ? 'text-red-500' : 
                                item.confidence === 'medium' ? 'text-amber-500' : 
                                'text-slate-400'
                              }`} />
                              <span className="font-semibold text-slate-900">{item.item}</span>
                              <span className="text-xs text-slate-500 capitalize">
                                ({item.confidence} confidence)
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{item.reason}</p>
                            <p className="text-sm font-semibold text-green-700">
                              Suggested: ${item.suggested_amount.toFixed(2)}
                            </p>
                          </div>
                          {onAddSuggestion && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onAddSuggestion(item);
                                toast.success(`Added ${item.item} to invoice`);
                              }}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {suggestions.notes && (
                      <p className="text-xs text-slate-600 italic mt-2">
                        💡 {suggestions.notes}
                      </p>
                    )}
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSuggestions(null);
                    setChecked(false);
                  }}
                  className="text-slate-500"
                >
                  Check Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}