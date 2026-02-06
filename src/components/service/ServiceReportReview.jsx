import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowLeft, CheckCircle2 } from "lucide-react";
import { format } from 'date-fns';

export default function ServiceReportReview({ 
  report, 
  customer,
  open, 
  onOpenChange, 
  onComplete,
  isSaving 
}) {
  if (!report) return null;

  const diagnostic = report.cat_diagnostic || {};
  const steps = [
    { num: 1, title: "Verify Customer Complaint", content: diagnostic.step1_verify_complaint },
    { num: 2, title: "Conduct Initial Inspection", content: diagnostic.step2_initial_inspection },
    { num: 3, title: "List Possible Causes", content: diagnostic.step3_list_causes },
    { num: 4, title: "Analyze Possible Causes / Determine Root Cause", content: diagnostic.step4_analyze_causes },
    { num: 5, title: "Repair Root Cause", content: diagnostic.step5_repair },
    { num: 6, title: "Verify Repair", content: diagnostic.step6_verify_repair }
  ];

  const totals = {
    service: (report.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0),
    destination: report.destination_fee?.total || 0
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            Final Report Review
          </DialogTitle>
          <p className="text-sm text-slate-600">
            Review how this report will appear to customers and management
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Header Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{customer?.company_name}</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {report.equipment_make} {report.equipment_model} • {report.equipment_type}
                  </p>
                  <p className="text-xs text-slate-500">
                    Service Date: {format(new Date(report.service_date), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    ${(totals.service + totals.destination).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">Total Amount</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Customer Complaint */}
          {report.complaint && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Customer Complaint</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.complaint}</p>
              </CardContent>
            </Card>
          )}

          {/* CAT 7-Step Diagnostic Process */}
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-amber-600">CAT 7-Step Diagnostic Process</span>
                <Badge variant="outline" className="text-xs">Industry Standard</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map(step => (
                step.content && (
                  <div key={step.num} className="border-l-2 border-slate-200 pl-4">
                    <p className="text-sm font-semibold text-amber-600 mb-1">
                      Step {step.num}: {step.title}
                    </p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{step.content}</p>
                  </div>
                )
              ))}
            </CardContent>
          </Card>

          {/* Evidence Summary */}
          {(report.photos_initial?.length > 0 || report.photos_failure?.length > 0 || 
            report.photos?.length > 0 || report.location_data || report.safety_precision_notes ||
            report.fluid_samples?.length > 0) && (
            <Card className="border-l-4 border-l-green-600">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  📋 Documentation & Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {report.photos_initial?.length > 0 && (
                  <p>✓ Initial condition photos: {report.photos_initial.length}</p>
                )}
                {report.photos_failure?.length > 0 && (
                  <p>✓ Component failure photos: {report.photos_failure.length}</p>
                )}
                {report.photos?.length > 0 && (
                  <p>✓ Additional service photos: {report.photos.length}</p>
                )}
                {report.location_data && (
                  <p>✓ GPS location verified</p>
                )}
                {report.safety_precision_notes && (
                  <p>✓ Safety & precision measurements documented</p>
                )}
                {report.fluid_samples?.length > 0 && (
                  <p>✓ Fluid samples: {report.fluid_samples.length}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Billing Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.service_items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.description}</span>
                  <span className="font-semibold">${item.total.toFixed(2)}</span>
                </div>
              ))}
              {totals.destination > 0 && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span>Destination Fee</span>
                  <span className="font-semibold">${totals.destination.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 pt-3">
                <span>Total</span>
                <span>${(totals.service + totals.destination).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Edit
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onComplete}
              disabled={isSaving}
            >
              <Send className="w-4 h-4 mr-2" />
              Complete & Invoice
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}