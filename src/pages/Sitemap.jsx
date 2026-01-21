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
  ClipboardCheck
} from "lucide-react";

export default function Sitemap() {
  const pages = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'FieldTech', icon: Wrench },
    { name: 'Authorizations', icon: ClipboardCheck },
    { name: 'ServiceReports', icon: FileText },
    { name: 'PartsOrders', icon: Package },
    { name: 'PartsInventory', icon: Package },
    { name: 'Invoices', icon: Receipt },
    { name: 'Customers', icon: Users },
    { name: 'FinancialExports', icon: FileText },
    { name: 'CustomerPortal', icon: Users },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <Link
                  key={page.name}
                  to={createPageUrl(page.name)}
                  className="flex items-center gap-3 p-4 rounded-lg border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
                >
                  <Icon className="w-5 h-5 text-slate-500" />
                  <span className="font-medium text-slate-900">{page.name}</span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}