import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LayoutDashboard,
  Wrench,
  FileText,
  Users,
  Package,
  Receipt,
  ClipboardCheck,
  Download,
  Shield,
  Truck
} from "lucide-react";

export default function Sitemap() {
  const pages = [
    { name: 'Dashboard', icon: LayoutDashboard, description: 'Overview and analytics' },
    { name: 'FieldTech', icon: Wrench, description: 'Mobile field technician view' },
    { name: 'Jobs', icon: ClipboardCheck, description: 'Job management and tracking' },
    { name: 'Authorizations', icon: ClipboardCheck, description: 'Pre-repair authorizations' },
    { name: 'ServiceReports', icon: FileText, description: 'Service reports and diagnostics' },
    { name: 'PartsOrders', icon: Package, description: 'Parts ordering and tracking' },
    { name: 'PartsInventory', icon: Package, description: 'Parts inventory management' },
    { name: 'VehicleExpenses', icon: Truck, description: 'Vehicle fuel and maintenance' },
    { name: 'Invoices', icon: Receipt, description: 'Invoice generation and tracking' },
    { name: 'PaymentLog', icon: Receipt, description: 'Cash/check payment records' },
    { name: 'Customers', icon: Users, description: 'Customer management' },
    { name: 'DataManagement', icon: Download, description: 'Export reports and import data' },
    { name: 'SecurityChecklist', icon: Shield, description: 'Security audit checklist' },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Sitemap</h1>
        <p className="text-slate-500 mt-1">All pages in the application</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <Link
                  key={page.name}
                  to={createPageUrl(page.name)}
                  className="flex items-start gap-4 p-5 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <Icon className="w-6 h-6 text-slate-600 group-hover:text-amber-600 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{page.name}</h3>
                    <p className="text-sm text-slate-500">{page.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}