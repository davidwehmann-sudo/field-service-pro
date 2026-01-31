import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FileText, 
  Users,
  Package,
  Search,
  Calendar,
  Wrench,
  Receipt,
  ClipboardCheck
} from "lucide-react";
import { format } from 'date-fns';
import OfflineIndicator from '@/components/service/OfflineIndicator';

export default function FieldTech() {
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        // Block customers
        if (user.user_type === 'service_customer') {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        navigate(createPageUrl('Home'));
      }
    };
    loadUser();
  }, [navigate]);

  const { data: reports = [] } = useQuery({
    queryKey: ['serviceReports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 10)
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const recentReports = reports.slice(0, 5);

  const filteredCustomers = customers
    .filter(c => 
      c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 5);

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.company_name || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Field Tech</h1>
              <p className="text-xs text-slate-400">Mobile Dashboard</p>
            </div>
          </div>
          <OfflineIndicator />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to={createPageUrl('ServiceReports') + '?new=true'}>
            <Button className="w-full h-24 bg-amber-500 hover:bg-amber-600 text-white flex-col gap-2">
              <Plus className="w-6 h-6" />
              <span className="font-semibold">New Report</span>
            </Button>
          </Link>
          <Link to={createPageUrl('PartsOrders') + '?new=true'}>
            <Button className="w-full h-24 bg-blue-600 hover:bg-blue-700 text-white flex-col gap-2">
              <Package className="w-6 h-6" />
              <span className="font-semibold">Order Parts</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Authorizations') + '?new=true'}>
            <Button className="w-full h-24 bg-purple-600 hover:bg-purple-700 text-white flex-col gap-2">
              <ClipboardCheck className="w-6 h-6" />
              <span className="font-semibold">Pre-Auth</span>
            </Button>
          </Link>
          <Link to={createPageUrl('ReceiptUpload')}>
            <Button className="w-full h-24 bg-green-600 hover:bg-green-700 text-white flex-col gap-2">
              <Receipt className="w-6 h-6" />
              <span className="font-semibold">Capture Receipt</span>
            </Button>
          </Link>
        </div>

        {/* Customer Quick Search */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-slate-600" />
              <h2 className="font-semibold text-slate-900">Quick Customer Lookup</h2>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {search && filteredCustomers.map((customer) => (
                <Link 
                  key={customer.id}
                  to={createPageUrl('ServiceReports') + `?new=true&customer=${customer.id}`}
                >
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div>
                      <p className="font-medium text-slate-900">{customer.company_name}</p>
                      {customer.contact_name && (
                        <p className="text-xs text-slate-500">{customer.contact_name}</p>
                      )}
                    </div>
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                </Link>
              ))}
              {search && filteredCustomers.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No customers found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Recent Reports</h2>
              </div>
              <Link to={createPageUrl('ServiceReports')}>
                <Button variant="ghost" size="sm" className="text-amber-600">
                  View All
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {recentReports.map((report) => (
                <Link 
                  key={report.id}
                  to={createPageUrl('ServiceReports') + `?id=${report.id}`}
                >
                  <div className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-slate-900 text-sm">
                        {getCustomerName(report.customer_id)}
                      </p>
                      <Badge 
                        className={
                          report.status === 'draft' ? 'bg-slate-200 text-slate-700' :
                          report.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {report.equipment_type && <span>{report.equipment_type}</span>}
                      {report.service_date && (
                        <>
                          <span>•</span>
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(report.service_date), 'MMM d')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              {recentReports.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No reports yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}