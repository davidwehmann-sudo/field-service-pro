import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OriginalNotesViewer({ report, open, onOpenChange }) {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Original Notes - ${report?.id || 'Report'}`,
    pageStyle: `
      @page {
        size: letter;
        margin: 1in;
      }
      @media print {
        body {
          font-family: Arial, sans-serif;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  });

  if (!report?.original_technician_notes) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Original Technician Notes
              </DialogTitle>
              <DialogDescription className="mt-2">
                Legal record: Unmodified notes as entered before AI processing
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div ref={printRef} className="space-y-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Legal Record
              </Badge>
              <p className="text-sm text-amber-900 flex-1">
                This is the original, unformatted record as entered by the technician before any AI processing. 
                Preserved for legal, audit, and compliance purposes.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-500 space-y-1">
              <div><strong>Report ID:</strong> {report.id}</div>
              <div><strong>Service Date:</strong> {new Date(report.service_date).toLocaleDateString()}</div>
              <div><strong>Created:</strong> {new Date(report.created_date).toLocaleString()}</div>
              {report.equipment_type && (
                <div><strong>Equipment:</strong> {report.equipment_type} {report.equipment_make} {report.equipment_model}</div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <div className="font-semibold text-sm text-slate-700 mb-3">Original Notes:</div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-900 leading-relaxed">
              {report.original_technician_notes}
            </pre>
          </div>

          <div className="text-xs text-slate-500 italic text-center pt-4 border-t">
            This document was preserved on {new Date(report.created_date).toLocaleString()} and remains unmodified
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}