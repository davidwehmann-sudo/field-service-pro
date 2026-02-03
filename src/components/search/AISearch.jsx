import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Search, FileText, Calendar, Wrench, AlertCircle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function AISearch({ customers = [], reports = [] }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    
    try {
      const searchContext = {
        customers: customers.map(c => ({
          id: c.id,
          name: c.company_name,
          contact: c.contact_name,
          phone: c.phone,
          city: c.city,
          state: c.state
        })),
        recentReports: reports.slice(0, 20).map(r => ({
          id: r.id,
          customer_id: r.customer_id,
          equipment_type: r.equipment_type,
          equipment_make: r.equipment_make,
          equipment_model: r.equipment_model,
          complaint: r.complaint,
          service_date: r.service_date,
          status: r.status,
          work_performed: r.work_performed?.substring(0, 200)
        }))
      };

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI search assistant for field service technicians. Analyze this search query and return relevant results.

Query: "${query}"

Available Data:
${JSON.stringify(searchContext, null, 2)}

Return results in this format:
1. interpretation - What the technician is looking for
2. customers - Array of relevant customer IDs with reason
3. reports - Array of relevant report IDs with reason
4. suggestions - Array of helpful action suggestions

Match based on: equipment type, customer name, location, problem descriptions, dates, or any contextual clues.`,
        response_json_schema: {
          type: "object",
          properties: {
            interpretation: { type: "string" },
            customers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            reports: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      setResults({
        ...response,
        customerObjects: response.customers?.map(c => 
          customers.find(cust => cust.id === c.id)
        ).filter(Boolean) || [],
        reportObjects: response.reports?.map(r => 
          reports.find(rep => rep.id === r.id)
        ).filter(Boolean) || []
      });
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">AI Search</h2>
            <p className="text-xs text-slate-500">Ask in plain language</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Input 
            placeholder="E.g., 'John Deere tractors with hydraulic issues' or 'Smith farm jobs'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            disabled={searching}
          />
          <Button 
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {results && (
          <div className="space-y-4">
            {/* Interpretation */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Understanding:</strong> {results.interpretation}
              </p>
            </div>

            {/* Customers */}
            {results.customerObjects?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-slate-600" />
                  <h3 className="font-medium text-sm">Customers ({results.customerObjects.length})</h3>
                </div>
                <div className="space-y-2">
                  {results.customerObjects.map((customer, idx) => {
                    const reason = results.customers.find(c => c.id === customer.id)?.reason;
                    return (
                      <Link 
                        key={customer.id}
                        to={createPageUrl('ServiceReports') + `?new=true&customer=${customer.id}`}
                      >
                        <div className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                          <p className="font-medium text-slate-900 text-sm">{customer.company_name}</p>
                          {customer.contact_name && (
                            <p className="text-xs text-slate-500">{customer.contact_name}</p>
                          )}
                          {reason && (
                            <p className="text-xs text-blue-600 mt-1">💡 {reason}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reports */}
            {results.reportObjects?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <h3 className="font-medium text-sm">Reports ({results.reportObjects.length})</h3>
                </div>
                <div className="space-y-2">
                  {results.reportObjects.map((report, idx) => {
                    const reason = results.reports.find(r => r.id === report.id)?.reason;
                    return (
                      <Link 
                        key={report.id}
                        to={createPageUrl('ServiceReports') + `?id=${report.id}`}
                      >
                        <div className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-medium text-slate-900 text-sm">
                              {getCustomerName(report.customer_id)}
                            </p>
                            <Badge className="bg-slate-200 text-slate-700 text-xs">
                              {report.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                            {report.equipment_type && <span>{report.equipment_type}</span>}
                            {report.equipment_make && <span>• {report.equipment_make}</span>}
                            {report.service_date && (
                              <>
                                <span>•</span>
                                <Calendar className="w-3 h-3" />
                                <span>{format(new Date(report.service_date), 'MMM d, yyyy')}</span>
                              </>
                            )}
                          </div>
                          {reason && (
                            <p className="text-xs text-blue-600">💡 {reason}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {results.suggestions?.length > 0 && (
              <div>
                <h3 className="font-medium text-sm mb-2 text-slate-700">Suggestions</h3>
                <div className="space-y-1">
                  {results.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-amber-500">→</span>
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {results.customerObjects?.length === 0 && results.reportObjects?.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No results found. Try rephrasing your search.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}