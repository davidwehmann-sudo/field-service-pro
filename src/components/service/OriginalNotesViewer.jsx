import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OriginalNotesViewer({ report, open, onOpenChange }) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Original Technician Notes - ${report.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .meta {
              color: #666;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 15px;
              border-radius: 5px;
              margin-bottom: 30px;
            }
            .warning-title {
              font-weight: bold;
              margin-bottom: 5px;
            }
            .notes-label {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
            }
            .notes-content {
              white-space: pre-wrap;
              font-family: 'Courier New', monospace;
              background: #f5f5f5;
              padding: 20px;
              border-radius: 5px;
              border: 1px solid #ddd;
              line-height: 1.6;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Original Technician Notes</div>
            <div class="meta">Report ID: ${report.id}</div>
            <div class="meta">Service Date: ${new Date(report.service_date).toLocaleDateString()}</div>
            <div class="meta">Customer: ${report.customer_id}</div>
            <div class="meta">Equipment: ${report.equipment_type} ${report.equipment_make || ''} ${report.equipment_model || ''}</div>
            <div class="meta">Created: ${new Date(report.created_date).toLocaleString()}</div>
          </div>
          
          <div class="warning">
            <div class="warning-title">⚠️ Legal Record</div>
            <div>This document contains the original, unmodified technician notes as entered in the field before any AI processing or formatting. This is the legally preserved record.</div>
          </div>

          <div class="notes-label">Original Unformatted Notes:</div>
          <div class="notes-content">${(report.original_technician_notes || 'No original notes preserved').replace(/\n/g, '<br>')}</div>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} | This is an official record copy
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!report?.original_technician_notes) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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

        <div className="space-y-4 mt-4">
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