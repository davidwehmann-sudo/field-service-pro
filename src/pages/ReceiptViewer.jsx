import React, { useState, useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Package, DollarSign, ExternalLink } from "lucide-react";

export default function ReceiptViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const { data: partsOrders = [], isLoading } = useQuery({
    queryKey: ['parts-orders-for-receipts'],
    queryFn: () => base44.entities.PartsOrder.list('-order_date'),
  });

  // Group parts by receipt_url
  const receiptGroups = useMemo(() => {
    const groups = {};
    partsOrders.forEach(order => {
      if (order.receipt_url && order.receipt_url.trim()) {
        if (!groups[order.receipt_url]) {
          groups[order.receipt_url] = {
            receipt_url: order.receipt_url,
            parts: [],
            totalCost: 0,
            totalShipping: 0,
            supplier: order.supplier,
            order_date: order.order_date
          };
        }
        groups[order.receipt_url].parts.push(order);
        groups[order.receipt_url].totalCost += (order.unit_cost || 0) * (order.quantity || 1);
        groups[order.receipt_url].totalShipping = Math.max(
          groups[order.receipt_url].totalShipping,
          order.shipping_cost || 0
        );
      }
    });
    return Object.values(groups);
  }, [partsOrders]);

  const filteredReceipts = useMemo(() => {
    if (!searchQuery) return receiptGroups;
    const lower = searchQuery.toLowerCase();
    return receiptGroups.filter(group => 
      group.supplier?.toLowerCase().includes(lower) ||
      group.parts.some(p => 
        p.part_number?.toLowerCase().includes(lower) ||
        p.part_description?.toLowerCase().includes(lower)
      )
    );
  }, [receiptGroups, searchQuery]);

  const getReceiptFileName = (url) => {
    try {
      return decodeURIComponent(url.split('/').pop());
    } catch {
      return 'Receipt';
    }
  };

  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receipt Viewer</h1>
          <p className="text-sm text-slate-500">Review uploaded receipts and extracted data</p>
        </div>
        <Badge variant="outline" className="w-fit">
          {receiptGroups.length} Receipts
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by supplier or part..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receipts List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Receipts</h2>
          {filteredReceipts.map((group, idx) => (
            <Card 
              key={idx}
              className={`cursor-pointer transition-all ${
                selectedReceipt === group ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
              }`}
              onClick={() => setSelectedReceipt(group)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {group.supplier || 'Unknown Supplier'}
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-1">
                      {group.order_date || 'No date'}
                    </p>
                  </div>
                  <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{group.parts.length} parts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">
                      ${group.totalCost.toFixed(2)}
                      {group.totalShipping > 0 && ` + $${group.totalShipping.toFixed(2)} shipping`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredReceipts.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">No receipts found</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Receipt Detail View */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selectedReceipt ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Receipt Document</CardTitle>
                    <a 
                      href={selectedReceipt.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPDF(selectedReceipt.receipt_url) ? (
                    <div className="bg-slate-100 rounded-lg p-8 text-center">
                      <FileText className="w-16 h-16 mx-auto mb-3 text-slate-400" />
                      <p className="text-sm text-slate-600 mb-3">
                        {getReceiptFileName(selectedReceipt.receipt_url)}
                      </p>
                      <a 
                        href={selectedReceipt.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button>Open PDF</Button>
                      </a>
                    </div>
                  ) : (
                    <img 
                      src={selectedReceipt.receipt_url} 
                      alt="Receipt" 
                      className="w-full rounded-lg border border-slate-200"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Extracted Parts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedReceipt.parts.map((part, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 truncate">
                              {part.part_description}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              PN: {part.part_number}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-slate-900">
                              ${((part.unit_cost || 0) * (part.quantity || 1)).toFixed(2)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Qty: {part.quantity || 1}
                            </p>
                          </div>
                        </div>
                        {part.shipping_cost > 0 && (
                          <p className="text-xs text-blue-600 mt-2">
                            + ${part.shipping_cost.toFixed(2)} shipping
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Parts Total:</span>
                      <span>${selectedReceipt.totalCost.toFixed(2)}</span>
                    </div>
                    {selectedReceipt.totalShipping > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="font-medium">Shipping:</span>
                        <span>${selectedReceipt.totalShipping.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold mt-2">
                      <span>Total:</span>
                      <span>${(selectedReceipt.totalCost + selectedReceipt.totalShipping).toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-400">Select a receipt to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}