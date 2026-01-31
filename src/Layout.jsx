import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import CompanySelector from './components/CompanySelector';
import { 
        Wrench, 
        FileText, 
        Users, 
        Package, 
        Receipt, 
        LayoutDashboard,
        Menu,
        X,
        ChevronRight,
        ClipboardCheck,
        MessageSquare,
        Download,
        Shield
      } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allNavigation = {
  service_technician: [
    { name: 'Field Tech', href: 'FieldTech', icon: Wrench },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { name: 'Parts', href: 'PartsOrders', icon: Package },
    { name: 'Our Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'Customers', href: 'Customers', icon: Users },
  ],
  parts_specialist: [
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { name: 'Orders', href: 'PartsOrders', icon: Package },
    { name: 'Our Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'Service', href: 'ServiceReports', icon: FileText },
    { name: 'Customers', href: 'Customers', icon: Users },
  ],
  bookkeeper: [
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Fleet Costs', href: 'VehicleExpenses', icon: Package },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'Service', href: 'ServiceReports', icon: FileText },
    { name: 'Data', href: 'DataManagement', icon: FileText },
    { name: 'Customers', href: 'Customers', icon: Users },
  ],
  software_engineer: [
    { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard },
    { name: 'Field', href: 'FieldTech', icon: Wrench },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Pre-Auth', href: 'Authorizations', icon: ClipboardCheck },
    { name: 'Service', href: 'ServiceReports', icon: FileText },
    { name: 'Parts', href: 'PartsOrders', icon: Package },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { name: 'Our Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Data', href: 'DataManagement', icon: Download },
    { name: 'Security', href: 'SecurityChecklist', icon: Shield },
    { name: 'Sitemap', href: 'Sitemap', icon: Download },
  ],
  service_admin: [
    { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard },
    { name: 'Field', href: 'FieldTech', icon: Wrench },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Pre-Auth', href: 'Authorizations', icon: ClipboardCheck },
    { name: 'Service', href: 'ServiceReports', icon: FileText },
    { name: 'Parts', href: 'PartsOrders', icon: Package },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { name: 'Our Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Data', href: 'DataManagement', icon: Download },
    { name: 'Security', href: 'SecurityChecklist', icon: Shield },
    { name: 'Sitemap', href: 'Sitemap', icon: Download },
  ]
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userType, setUserType] = useState('service_admin');
  const [currentUser, setCurrentUser] = useState(null);
  const [displayCompany, setDisplayCompany] = useState(null);

  useEffect(() => {
    const loadUserType = async () => {
        try {
          const user = await base44.auth.me();
          setUserType(user.user_type || 'service_admin');
          setCurrentUser(user);
          setDisplayCompany(user.current_company || user.company);
        } catch (error) {
          setUserType('service_admin');
        }
      };
      loadUserType();
  }, []);

  const navigation = allNavigation[userType] || allNavigation.service_admin;

  const formatUserType = (type) => {
    if (!type) return 'Unknown';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">{displayCompany || 'Wehmann'}</h1>
              <p className="text-xs text-slate-400">Field Service Pro</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden text-slate-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
          </div>

          {currentUser && (
            <div className="px-6 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-1">Logged in as</p>
              <p className="text-sm font-medium text-white truncate">{currentUser.full_name || currentUser.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser.role && <span className="capitalize">{currentUser.role}</span>}
                {currentUser.role && currentUser.user_type && ' • '}
                {currentUser.user_type && formatUserType(currentUser.user_type)}
              </p>
            </div>
          )}

          <CompanySelector currentUser={currentUser} onCompanyChange={setDisplayCompany} />

          <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          {navigation.map((item) => {
            const isActive = currentPageName === item.href;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-amber-500 text-white" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
          </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">{displayCompany || 'Wehmann'}</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}