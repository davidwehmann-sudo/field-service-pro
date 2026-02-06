import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Download,
  Calendar,
  DollarSign,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Loader2,
  FileUp,
  Image
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function DataManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navigate = useNavigate();

  // Import states
  const [csvFile, setCsvFile] = useState(null);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Receipt download states
  const [downloadingReceipts, setDownloadingReceipts] = useState(false);
  const [receiptDownloadResult, setReceiptDownloadResult] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        setCurrentUser(null);
      }
    };
    loadUser();

    // Default to current year
    const now = new Date();
    setStartDate(format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'));
    setEndDate(format(now, 'yyyy-MM-dd'));
  }, []);

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: serviceReports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  // Export functions
  const filterByDate = (items, dateField) => {
    if (!startDate || !endDate) return items;
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
  };

  const downloadCSV = (headers, rows, filename) => {
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportInvoices = () => {
    const filtered = filterByDate(invoices, 'invoice_date');
    const headers = ['Invoice Number', 'Customer', 'Invoice Date', 'Due Date', 'Labor Total', 'Travel Total', 'Parts Total', 'Tax Amount', 'Total Amount', 'Status', 'Payment Date', 'Payment Method', 'Payment Reference'];
    const rows = filtered.map(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      return [inv.invoice_number || '', customer?.company_name || '', inv.invoice_date || '', inv.due_date || '', inv.labor_total || 0, inv.travel_total || 0, inv.parts_total || 0, inv.tax_amount || 0, inv.total_amount || 0, inv.status || '', inv.payment_date || '', inv.payment_method || '', inv.payment_reference || ''];
    });
    downloadCSV(headers, rows, 'invoices');
    toast.success(`Exported ${filtered.length} invoices`);
  };

  const exportServiceReports = () => {
    const filtered = filterByDate(serviceReports, 'service_date');
    const headers = ['Service Date', 'Customer', 'Equipment Type', 'Equipment Make', 'Equipment Model', 'Equipment Serial', 'Equipment Hours', 'Work Performed', 'Labor Total', 'Travel Mileage', 'Travel Total', 'Status', 'Created By', 'Created Date'];
    const rows = filtered.map(report => {
      const customer = customers.find(c => c.id === report.customer_id);
      const laborTotal = (report.service_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const travelTotal = report.destination_fee?.total || 0;
      return [report.service_date || '', customer?.company_name || '', report.equipment_type || '', report.equipment_make || '', report.equipment_model || '', report.equipment_serial || '', report.equipment_hours || '', report.work_performed || '', laborTotal, report.destination_fee?.mileage || 0, travelTotal, report.status || '', report.created_by || '', format(new Date(report.created_date), 'yyyy-MM-dd')];
    });
    downloadCSV(headers, rows, 'service-reports');
    toast.success(`Exported ${filtered.length} service reports`);
  };

  const exportPayments = () => {
    const paidInvoices = filterByDate(invoices.filter(inv => inv.status === 'paid' && inv.payment_date), 'payment_date');
    const headers = ['Payment Date', 'Invoice Number', 'Customer', 'Payment Method', 'Payment Reference', 'Amount Paid', 'Labor', 'Travel', 'Parts', 'Tax'];
    const rows = paidInvoices.map(inv => {
      const customer = customers.find(c => c.id === inv.customer_id);
      return [inv.payment_date, inv.invoice_number || '', customer?.company_name || '', inv.payment_method || '', inv.payment_reference || '', inv.total_amount || 0, inv.labor_total || 0, inv.travel_total || 0, inv.parts_total || 0, inv.tax_amount || 0];
    });
    downloadCSV(headers, rows, 'payments');
    toast.success(`Exported ${paidInvoices.length} payments`);
  };

  const exportComprehensive = () => {
    const filteredInvoices = filterByDate(invoices, 'invoice_date');
    const filteredReports = filterByDate(serviceReports, 'service_date');
    const totalRevenue = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalPending = filteredInvoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalTax = filteredInvoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    
    const headers = ['Summary Report', `Period: ${startDate} to ${endDate}`, '', 'Metric', 'Amount'];
    const rows = [
      [''], ['Financial Summary', ''], ['Total Revenue (Paid)', '', '', '', totalRevenue], ['Pending Invoices', '', '', '', totalPending], ['Total Tax Collected', '', '', '', totalTax], ['Total Invoices', '', '', '', filteredInvoices.length], ['Total Service Reports', '', '', '', filteredReports.length], [''], [''], ['Detailed Invoice Data'], ['Invoice Number', 'Date', 'Customer', 'Labor', 'Travel', 'Parts', 'Tax', 'Total', 'Status', 'Payment Date'],
      ...filteredInvoices.map(inv => {
        const customer = customers.find(c => c.id === inv.customer_id);
        return [inv.invoice_number || '', inv.invoice_date || '', customer?.company_name || '', inv.labor_total || 0, inv.travel_total || 0, inv.parts_total || 0, inv.tax_amount || 0, inv.total_amount || 0, inv.status || '', inv.payment_date || ''];
      })
    ];
    downloadCSV(headers, rows, 'comprehensive-financial-report');
    toast.success('Exported comprehensive financial report');
  };

  const bulkDownloadReceipts = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range');
      return;
    }

    setDownloadingReceipts(true);
    setReceiptDownloadResult(null);
    try {
      const response = await base44.functions.invoke('bulkDownloadReceipts', {
        start_date: startDate,
        end_date: endDate
      });

      setReceiptDownloadResult(response.data);

      if (response.data.count === 0) {
        toast.info('No receipts found in this date range');
      } else {
        toast.success(`Found ${response.data.count} receipts`);
      }
    } catch (error) {
      toast.error('Failed to fetch receipt URLs');
    } finally {
      setDownloadingReceipts(false);
    }
  };

  const downloadReceiptFile = async (receipt) => {
    try {
      const response = await fetch(receipt.download_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = receipt.filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${receipt.filename}`);
    } catch (error) {
      toast.error(`Failed to download ${receipt.filename}`);
    }
  };

  const downloadAllReceipts = async () => {
    if (!receiptDownloadResult?.receipts) return;
    
    toast.info(`Downloading ${receiptDownloadResult.receipts.length} receipts...`);
    
    for (const receipt of receiptDownloadResult.receipts) {
      await downloadReceiptFile(receipt);
      // Small delay to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    toast.success('All receipts downloaded');
  };

  // Import functions
  const loadSpreadsheets = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('googleSheets', { action: 'list_spreadsheets' });
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
      const response = await base44.functions.invoke('googleSheets', { action: 'get_sheet_data', spreadsheet_id: spreadsheetId });
      setSheetData(response.data);
      setSelectedSpreadsheet(spreadsheetId);
      
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

  const handleCsvUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))).filter(row => row.some(cell => cell));

      if (rows.length < 2) {
        toast.error('CSV must have at least a header row and one data row');
        return;
      }

      setSheetData({ values: rows });
      setCsvFile(file);

      const headers = rows[0];
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
      toast.success('CSV loaded successfully!');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!sheetData?.values || sheetData.values.length < 2) {
      toast.error('No data to import');
      return;
    }

    setImporting(true);
    try {
      const [headers, ...rows] = sheetData.values;
      const response = await base44.functions.invoke('googleSheets', { action: 'import_data', rows: rows.filter(row => row.length > 0), column_mapping: columnMapping });
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

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-500">Loading...</p></div>;
  }

  if (!['service_admin', 'bookkeeper', 'software_engineer'].includes(currentUser.user_type)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access data management.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const exportOptions = [
    { title: 'Invoices', description: 'Complete invoice data with payments', icon: FileText, action: exportInvoices, color: 'bg-blue-500' },
    { title: 'Service Reports', description: 'Detailed service records with labor', icon: FileSpreadsheet, action: exportServiceReports, color: 'bg-green-500' },
    { title: 'Payments', description: 'All received payments', icon: DollarSign, action: exportPayments, color: 'bg-amber-500' },
    { title: 'Comprehensive', description: 'All financial data in one file', icon: Download, action: exportComprehensive, color: 'bg-slate-700' },
    { title: 'Receipt Images', description: 'Bulk download original receipt photos', icon: Image, action: bulkDownloadReceipts, color: 'bg-purple-500' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
        <p className="text-slate-500 mt-1">Export financial reports and import historical data</p>
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
              <CardDescription>Select period for your exports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card key={option.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className={`w-12 h-12 ${option.color} rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-base">{option.title}</CardTitle>
                    <CardDescription className="text-xs">{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={option.action} 
                      className="w-full" 
                      size="sm" 
                      variant="outline"
                      disabled={option.title === 'Receipt Images' && downloadingReceipts}
                    >
                      {option.title === 'Receipt Images' && downloadingReceipts ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" />Export</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {receiptDownloadResult && (
            <Card>
              <CardHeader>
                <CardTitle>Receipt Images ({receiptDownloadResult.count})</CardTitle>
                <CardDescription>
                  Found {receiptDownloadResult.count} receipts from {receiptDownloadResult.date_range.start_date} to {receiptDownloadResult.date_range.end_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button onClick={downloadAllReceipts} className="w-full bg-purple-600 hover:bg-purple-700">
                    <Download className="w-4 h-4 mr-2" />
                    Download All ({receiptDownloadResult.count} files)
                  </Button>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {receiptDownloadResult.receipts.map((receipt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Image className="w-5 h-5 text-purple-600 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate">{receipt.filename}</span>
                        </div>
                        <Button 
                          onClick={() => downloadReceiptFile(receipt)} 
                          size="sm" 
                          variant="ghost"
                          className="flex-shrink-0"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <Tabs defaultValue="csv">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                    <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <Label htmlFor="csv-upload" className="cursor-pointer">
                      <div className="text-sm text-slate-600 mb-2">Click to upload or drag and drop</div>
                      <div className="text-xs text-slate-500">CSV files only</div>
                    </Label>
                    <Input id="csv-upload" type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                    {csvFile && <div className="mt-4 text-sm text-green-600 font-medium">✓ {csvFile.name}</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sheets" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Connect Google Sheets</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">Import data directly from your Google Sheets spreadsheets.</p>
                  {!spreadsheets.length && (
                    <Button onClick={loadSpreadsheets} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                      {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</> : <><FileSpreadsheet className="w-4 h-4 mr-2" />Connect Google Sheets</>}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {spreadsheets.length > 0 && !selectedSpreadsheet && (
            <Card>
              <CardHeader>
                <CardTitle>Select a Spreadsheet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {spreadsheets.map((sheet) => (
                    <button key={sheet.id} onClick={() => loadSheetData(sheet.id)} className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <div className="text-left">
                          <p className="font-medium text-slate-900">{sheet.name}</p>
                          <p className="text-xs text-slate-500">Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}</p>
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
                    {['service_date', 'equipment_type', 'equipment_make', 'equipment_model', 'equipment_serial', 'complaint', 'work_performed'].map((field) => (
                      <div key={field} className={field === 'work_performed' ? 'col-span-2' : ''}>
                        <Label>{field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}{field === 'equipment_type' ? ' *' : ''}</Label>
                        <Select value={columnMapping[field]?.toString()} onValueChange={(v) => setColumnMapping({...columnMapping, [field]: parseInt(v)})}>
                          <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                          <SelectContent>
                            {getColumnOptions().map(opt => <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview & Import</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {sheetData.values[0]?.map((header, i) => <th key={i} className="px-4 py-2 text-left font-medium text-slate-700">{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sheetData.values.slice(1, 6).map((row, i) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            {row.map((cell, j) => <td key={j} className="px-4 py-2 text-slate-600">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sheetData.values.length > 6 && <p className="text-sm text-slate-500 mt-2 text-center">... and {sheetData.values.length - 6} more rows</p>}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-slate-600">Ready to import {sheetData.values.length - 1} service reports</p>
                    <Button onClick={handleImport} disabled={importing || columnMapping.equipment_type === undefined} className="bg-green-600 hover:bg-green-700">
                      {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import Data</>}
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
                    <p className="text-sm text-green-700">Successfully imported {importResult.imported} service reports{importResult.errors > 0 && ` (${importResult.errors} errors)`}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}