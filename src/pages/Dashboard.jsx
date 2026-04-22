import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Package, 
  Receipt, 
  Users, 
  Plus, 
  Clock,
  DollarSign,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import StatsCard from '@/components/dashboard/StatsCard';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Unassigned users are redirected by StaffOnlyRoute, this is a fallback
        if (!user.user_type || user.user_type === 'unassigned_user') {
          navigate(createPageUrl('RequestAuthorization'), { replace: true });
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);
  const { data: serviceReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 50)
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 50)
  });

  const { data: partsOrders = [], isLoading: loadingParts } = useQuery({
    queryKey: ['partsOrders'],
    queryFn: () => base44.entities.PartsOrder.list('-created_date', 50)
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const isLoading = loadingReports || loadingInvoices || loadingParts;

  // Calculate stats with memoization
  const stats = useMemo(() => {
    const draftReports = serviceReports.filter(r => r.status === 'open').length;
    const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
    const unpaidTotal = unpaidInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
    const pendingParts = partsOrders.filter(p => p.status === 'needed' || p.status === 'ordered').length;
    
    return { draftReports, unpaidInvoices: unpaidInvoices.length, unpaidTotal, pendingParts };
  }, [serviceReports, invoices, partsOrders]);

  const recentReports = useMemo(() => serviceReports.slice(0, 5), [serviceReports]);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  }, [customers]);

  const statusColors = {
    draft: "bg-slate-100 text-slate-700",
    completed: "bg-blue-100 text-blue-700",
    invoiced: "bg-green-100 text-green-700"
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, here's what's happening</p>

        </div>
        <Link to={createPageUrl('ServiceReports') + '?new=true'}>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25">
            <Plus className="w-4 h-4 mr-2" />
            New Service Report
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="p-5 border-0 shadow-sm">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Open Reports" 
            value={stats.draftReports}
            subtitle="Need completion"
            icon={FileText}
            color="orange"
          />
          <StatsCard 
            title="Unpaid Invoices" 
            value={`$${stats.unpaidTotal.toLocaleString()}`}
            subtitle={`${stats.unpaidInvoices} invoices`}
            icon={DollarSign}
            color="green"
          />
          <StatsCard 
            title="Pending Parts" 
            value={stats.pendingParts}
            subtitle="Orders to track"
            icon={Package}
            color="purple"
          />
          <StatsCard 
            title="Customers" 
            value={customers.length}
            subtitle="Total accounts"
            icon={Users}
            color="blue"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Service Reports */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Service Reports</CardTitle>
            <Link to={createPageUrl('ServiceReports')}>
              <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentReports.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No service reports yet</p>
                <Link to={createPageUrl('ServiceReports') + '?new=true'}>
                  <Button variant="link" className="text-amber-600 mt-2">
                    Create your first report
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <Link 
                    key={report.id} 
                    to={createPageUrl('ServiceReports') + `?id=${report.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {getCustomerName(report.customer_id)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {report.equipment_type} • {report.service_date && format(new Date(report.service_date), 'MMM d')}
                      </p>
                    </div>
                    <Badge className={statusColors[report.status]}>
                      {report.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link to={createPageUrl('ServiceReports') + '?new=true'}>
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-center cursor-pointer">
                <FileText className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-slate-900">New Report</p>
                <p className="text-xs text-slate-500">Start service</p>
              </div>
            </Link>
            <Link to={createPageUrl('Customers') + '?new=true'}>
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center cursor-pointer">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="font-medium text-slate-900">Add Customer</p>
                <p className="text-xs text-slate-500">New account</p>
              </div>
            </Link>
            <Link to={createPageUrl('PartsOrders') + '?new=true'}>
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-center cursor-pointer">
                <Package className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="font-medium text-slate-900">Order Parts</p>
                <p className="text-xs text-slate-500">Track order</p>
              </div>
            </Link>
            <Link to={createPageUrl('Invoices') + '?new=true'}>
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all text-center cursor-pointer">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="font-medium text-slate-900">Create Invoice</p>
                <p className="text-xs text-slate-500">Bill customer</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}