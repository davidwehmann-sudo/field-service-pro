import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, FileText, Calendar, Download } from "lucide-react";
import { format } from 'date-fns';

export default function TechnicianPayroll() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTech, setSelectedTech] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list('-service_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const technicianData = useMemo(() => {
    const techMap = {};
    
    reports.forEach(report => {
      if (!report.time_entries || report.time_entries.length === 0) return;
      
      const reportDate = new Date(report.service_date);
      const inDateRange = (!startDate || reportDate >= new Date(startDate)) &&
                         (!endDate || reportDate <= new Date(endDate));
      
      if (!inDateRange) return;
      
      report.time_entries.forEach(entry => {
        const techName = entry.technician || 'Unknown';
        
        if (!techMap[techName]) {
          techMap[techName] = {
            name: techName,
            totalHours: 0,
            entries: []
          };
        }
        
        techMap[techName].totalHours += entry.hours || 0;
        techMap[techName].entries.push({
          ...entry,
          reportId: report.id,
          reportDate: report.service_date,
          customer: customers.find(c => c.id === report.customer_id)?.company_name || 'Unknown',
          isInternal: report.is_internal
        });
      });
    });
    
    return Object.values(techMap).sort((a, b) => b.totalHours - a.totalHours);
  }, [reports, customers, startDate, endDate]);

  const totalHours = technicianData.reduce((sum, tech) => sum + tech.totalHours, 0);

  const handleExport = () => {
    const csv = [
      ['Technician', 'Date', 'Hours', 'Description', 'Customer', 'Type'].join(','),
      ...technicianData.flatMap(tech =>
        tech.entries.map(entry => [
          tech.name,
          format(new Date(entry.start_time), 'yyyy-MM-dd'),
          entry.hours.toFixed(2),
          `"${entry.description || ''}"`,
          `"${entry.customer}"`,
          entry.isInternal ? 'Internal' : 'Customer'
        ].join(','))
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `technician-payroll-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Technician Payroll</h1>
          <p className="text-slate-500 mt-1">Track labor hours for payroll</p>
        </div>
        <Button onClick={handleExport} variant="outline" disabled={technicianData.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="mt-3"
            >
              Clear Dates
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Hours</p>
                <p className="text-2xl font-bold text-slate-900">{totalHours.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Technicians</p>
                <p className="text-2xl font-bold text-slate-900">{technicianData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Date Range</p>
                <p className="text-sm font-semibold text-slate-900">
                  {startDate && endDate ? `${format(new Date(startDate), 'MMM d')} - ${format(new Date(endDate), 'MMM d')}` : 'All Time'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technician List */}
      {isLoading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-slate-500">
            Loading...
          </CardContent>
        </Card>
      ) : technicianData.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">No time entries found for this period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {technicianData.map((tech) => (
            <Card key={tech.name} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{tech.name}</CardTitle>
                  <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
                    {tech.totalHours.toFixed(2)} hrs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTech(selectedTech === tech.name ? null : tech.name)}
                  className="mb-3"
                >
                  {selectedTech === tech.name ? 'Hide' : 'Show'} Details ({tech.entries.length} entries)
                </Button>

                {selectedTech === tech.name && (
                  <div className="space-y-2 mt-3">
                    {tech.entries
                      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                      .map((entry, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span className="text-sm font-medium text-slate-900">
                                  {format(new Date(entry.reportDate), 'MMM d, yyyy')}
                                </span>
                                {entry.isInternal && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    Internal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{entry.customer}</p>
                              {entry.description && (
                                <p className="text-sm text-slate-500 mt-1">{entry.description}</p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
                                {format(new Date(entry.start_time), 'h:mm a')} → {format(new Date(entry.end_time), 'h:mm a')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900">{entry.hours.toFixed(2)}</p>
                              <p className="text-xs text-slate-500">hours</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}