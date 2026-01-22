import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportData() {
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadSpreadsheets = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('googleSheets', {
        action: 'list_spreadsheets'
      });
      
      setSpreadsheets(response.data.spreadsheets || []);
      if (response.data.spreadsheets?.length === 0) {
        toast.info('No spreadsheets found in your Google Drive');
      }
    } catch (error) {
      toast.error('Failed to load spreadsheets. Make sure Google Sheets is authorized.');
    } finally {
      setLoading(false);
    }
  };

  const loadSheetData = async (spreadsheetId) => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('googleSheets', {
        action: 'get_sheet_data',
        spreadsheet_id: spreadsheetId
      });
      
      setSheetData(response.data);
      setSelectedSpreadsheet(spreadsheetId);
      
      // Auto-detect columns
      if (response.data.values?.length > 0) {
        const headers = response.data.values[0];
        const mapping = {};
        
        headers.forEach((header, index) => {
          const lower = header.toLowerCase();
          if (lower.includes('date')) mapping.service_date = index;
          if (lower.includes('equipment') || lower.includes('machine')) mapping.equipment_type = index;
          if (lower.includes('make') || lower.includes('manufacturer')) mapping.equipment_make = index;
          if (lower.includes('model')) mapping.equipment_model = index;
          if (lower.includes('serial')) mapping.equipment_serial = index;
          if (lower.includes('complaint') || lower.includes('issue') || lower.includes('problem')) mapping.complaint = index;
          if (lower.includes('work') || lower.includes('repair') || lower.includes('service')) mapping.work_performed = index;
        });
        
        setColumnMapping(mapping);
      }
    } catch (error) {
      toast.error('Failed to load sheet data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!sheetData?.values || sheetData.values.length < 2) {
      toast.error('No data to import');
      return;
    }

    setImporting(true);
    try {
      const [headers, ...rows] = sheetData.values;
      
      const response = await base44.functions.invoke('googleSheets', {
        action: 'import_data',
        rows: rows.filter(row => row.length > 0),
        column_mapping: columnMapping
      });
      
      setImportResult(response.data);
      
      if (response.data.imported > 0) {
        toast.success(`Successfully imported ${response.data.imported} service reports!`);
      }
      
      if (response.data.errors > 0) {
        toast.warning(`${response.data.errors} rows failed to import`);
      }
    } catch (error) {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const getColumnOptions = () => {
    if (!sheetData?.values?.[0]) return [];
    return sheetData.values[0].map((header, index) => ({ label: header, value: index }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import Historical Data</h1>
          <p className="text-slate-600 mt-1">Import past repair records from Google Sheets</p>
        </div>
        {!spreadsheets.length && (
          <Button onClick={loadSpreadsheets} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Connect Google Sheets
              </>
            )}
          </Button>
        )}
      </div>

      {spreadsheets.length > 0 && !selectedSpreadsheet && (
        <Card>
          <CardHeader>
            <CardTitle>Select a Spreadsheet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {spreadsheets.map((sheet) => (
                <button
                  key={sheet.id}
                  onClick={() => loadSheetData(sheet.id)}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-slate-900">{sheet.name}</p>
                      <p className="text-xs text-slate-500">
                        Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Select</Button>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sheetData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Service Date</Label>
                  <Select 
                    value={columnMapping.service_date?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, service_date: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Equipment Type *</Label>
                  <Select 
                    value={columnMapping.equipment_type?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, equipment_type: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Equipment Make</Label>
                  <Select 
                    value={columnMapping.equipment_make?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, equipment_make: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Equipment Model</Label>
                  <Select 
                    value={columnMapping.equipment_model?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, equipment_model: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Equipment Serial</Label>
                  <Select 
                    value={columnMapping.equipment_serial?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, equipment_serial: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Complaint/Issue</Label>
                  <Select 
                    value={columnMapping.complaint?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, complaint: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>Work Performed</Label>
                  <Select 
                    value={columnMapping.work_performed?.toString()} 
                    onValueChange={(v) => setColumnMapping({...columnMapping, work_performed: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {getColumnOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {sheetData.values[0]?.map((header, i) => (
                        <th key={i} className="px-4 py-2 text-left font-medium text-slate-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetData.values.slice(1, 6).map((row, i) => (
                      <tr key={i} className="border-b hover:bg-slate-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2 text-slate-600">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheetData.values.length > 6 && (
                  <p className="text-sm text-slate-500 mt-2 text-center">
                    ... and {sheetData.values.length - 6} more rows
                  </p>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Ready to import {sheetData.values.length - 1} service reports
                </p>
                <Button
                  onClick={handleImport}
                  disabled={importing || columnMapping.equipment_type === undefined}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Data
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {importResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Import Complete!</p>
                <p className="text-sm text-green-700">
                  Successfully imported {importResult.imported} service reports
                  {importResult.errors > 0 && ` (${importResult.errors} errors)`}
                </p>
              </div>
            </div>
            {importResult.errors > 0 && (
              <details className="mt-4">
                <summary className="text-sm text-green-700 cursor-pointer">View errors</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(importResult.details, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}