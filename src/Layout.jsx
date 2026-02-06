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
        ChevronDown,
        ClipboardCheck,
        MessageSquare,
        Download,
        Shield,
        DollarSign
      } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const allNavigation = {
  service_technician: [
    { name: 'Field Tech', href: 'FieldTech', icon: Wrench },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'View Receipts', href: 'ReceiptViewer', icon: FileText },
    { type: 'section', label: 'Operations' },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { name: 'Parts Orders', href: 'PartsOrders', icon: Package },
    { type: 'section', label: 'Fleet' },
    { name: 'Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { type: 'section', label: 'Payroll' },
    { name: 'My Hours', href: 'TechnicianPayroll', icon: DollarSign },
    { type: 'section', label: 'Other' },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Ag Exemptions', href: 'AgExemptions', icon: Shield },
  ],
  parts_specialist: [
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'View Receipts', href: 'ReceiptViewer', icon: FileText },
    { type: 'section', label: 'Parts' },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { name: 'Orders', href: 'PartsOrders', icon: Package },
    { type: 'section', label: 'Operations' },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { type: 'section', label: 'Fleet' },
    { name: 'Vehicles', href: 'OwnVehicles', icon: Package },
    { type: 'section', label: 'Other' },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Ag Exemptions', href: 'AgExemptions', icon: Shield },
  ],
  bookkeeper: [
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'View Receipts', href: 'ReceiptViewer', icon: FileText },
    { type: 'section', label: 'Financial' },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Ag Exemptions', href: 'AgExemptions', icon: Shield },
    { type: 'section', label: 'Operations' },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { type: 'section', label: 'Fleet' },
    { name: 'Fleet Costs', href: 'VehicleExpenses', icon: Package },
    { type: 'section', label: 'Data' },
    { name: 'Data Export', href: 'DataManagement', icon: FileText },
    { name: 'Customers', href: 'Customers', icon: Users },
  ],
  software_engineer: [
    { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'View Receipts', href: 'ReceiptViewer', icon: FileText },
    { type: 'section', label: 'Operations' },
    { name: 'Field', href: 'FieldTech', icon: Wrench },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Pre-Auth', href: 'Authorizations', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { type: 'section', label: 'Parts & Inventory' },
    { name: 'Parts Orders', href: 'PartsOrders', icon: Package },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { type: 'section', label: 'Fleet' },
    { name: 'Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { type: 'section', label: 'Financial' },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Ag Exemptions', href: 'AgExemptions', icon: Shield },
    { name: 'Tech Payroll', href: 'TechnicianPayroll', icon: DollarSign },
    { type: 'section', label: 'Admin' },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Data Export', href: 'DataManagement', icon: Download },
    { name: 'Sitemap', href: 'Sitemap', icon: Download },
  ],
  service_admin: [
    { name: 'Dashboard', href: 'Dashboard', icon: LayoutDashboard },
    { name: 'Receipts', href: 'ReceiptUpload', icon: Receipt },
    { name: 'View Receipts', href: 'ReceiptViewer', icon: FileText },
    { type: 'section', label: 'Operations' },
    { name: 'Field', href: 'FieldTech', icon: Wrench },
    { name: 'Jobs', href: 'Jobs', icon: ClipboardCheck },
    { name: 'Pre-Auth', href: 'Authorizations', icon: ClipboardCheck },
    { name: 'Service Reports', href: 'ServiceReports', icon: FileText },
    { type: 'section', label: 'Parts & Inventory' },
    { name: 'Parts Orders', href: 'PartsOrders', icon: Package },
    { name: 'Inventory', href: 'PartsInventory', icon: Package },
    { type: 'section', label: 'Fleet' },
    { name: 'Vehicles', href: 'OwnVehicles', icon: Package },
    { name: 'Expenses', href: 'VehicleExpenses', icon: Package },
    { type: 'section', label: 'Financial' },
    { name: 'Invoices', href: 'Invoices', icon: Receipt },
    { name: 'Payments', href: 'PaymentLog', icon: Receipt },
    { name: 'Ag Exemptions', href: 'AgExemptions', icon: Shield },
    { name: 'Tech Payroll', href: 'TechnicianPayroll', icon: DollarSign },
    { type: 'section', label: 'Admin' },
    { name: 'Customers', href: 'Customers', icon: Users },
    { name: 'Data Export', href: 'DataManagement', icon: Download },
    { name: 'Sitemap', href: 'Sitemap', icon: Download },
  ],
  unassigned_user: [
    { name: 'Request Authorization', href: 'RequestAuthorization', icon: ClipboardCheck },
  ]
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userType, setUserType] = useState('unassigned_user');
  const [currentUser, setCurrentUser] = useState(null);
  const [displayCompany, setDisplayCompany] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  // Close sidebar when clicking a link
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPageName]);

  useEffect(() => {
    const loadUserType = async () => {
        try {
          const user = await base44.auth.me();
          setUserType(user.user_type || 'unassigned_user');
          setCurrentUser(user);
          setDisplayCompany(user.current_company || user.company);
          
          // Initialize all sections as collapsed by default
          const nav = allNavigation[user.user_type || 'unassigned_user'] || allNavigation.unassigned_user;
          const sections = {};
          nav.forEach((item, idx) => {
            if (item.type === 'section') {
              sections[idx] = false;
            }
          });
          setExpandedSections(sections);
        } catch (error) {
          setUserType('unassigned_user');
        }
      };
      loadUserType();
  }, []);

  const navigation = allNavigation[userType] || allNavigation.unassigned_user;

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
        "fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1.5">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69674c60fd09b2646ba37ec8/cc48f8410_tCMBf.jpg" 
                alt="Wehmann Logo" 
                className="w-full h-full object-contain"
              />
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
            <div className="px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <p className="text-xs text-slate-500 mb-1">Logged in as</p>
              <p className="text-sm font-medium text-white truncate">{currentUser.full_name || currentUser.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser.role && <span className="capitalize">{currentUser.role}</span>}
                {currentUser.role && currentUser.user_type && ' • '}
                {currentUser.user_type && formatUserType(currentUser.user_type)}
              </p>
            </div>
          )}

          <div className="flex-shrink-0">
            <CompanySelector currentUser={currentUser} onCompanyChange={setDisplayCompany} />
          </div>

          <nav className="p-4 space-y-1 overflow-y-auto flex-1 min-h-0">
          {navigation.map((item, index) => {
            if (item.type === 'section') {
              const isExpanded = expandedSections[index];
              return (
                <button
                  key={`section-${index}`}
                  onClick={() => setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }))}
                  className="w-full flex items-center justify-between px-4 pt-4 pb-2 text-left hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {item.label}
                  </p>
                  <ChevronDown 
                    className={cn(
                      "w-4 h-4 text-slate-500 transition-transform",
                      isExpanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              );
            }

            // Find the section this item belongs to
            let sectionIndex = null;
            for (let i = index - 1; i >= 0; i--) {
              if (navigation[i].type === 'section') {
                sectionIndex = i;
                break;
              }
            }

            // Hide if section is collapsed
            if (sectionIndex !== null && !expandedSections[sectionIndex]) {
              return null;
            }

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
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69674c60fd09b2646ba37ec8/cc48f8410_tCMBf.jpg" 
                  alt="Wehmann Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-slate-900">{displayCompany || 'Wehmann'}</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {children}
        </main>

        {/* Mobile FAB - Field Tech */}
        {userType !== 'unassigned_user' && userType !== 'service_customer' && (
          <Link 
            to={createPageUrl('FieldTech')}
            className="lg:hidden fixed bottom-6 right-6 z-40 group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium opacity-0 group-active:opacity-100 transition-opacity whitespace-nowrap">
                Field Tech
              </div>
              <button className="w-14 h-14 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95">
                <Wrench className="w-6 h-6" />
              </button>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}