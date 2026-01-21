import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Wrench, 
  Package, 
  Calculator, 
  Shield,
  Building2,
  ArrowRight,
  Loader2
} from "lucide-react";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Auto-route based on user type (default to customer if not set)
        const userType = currentUser.user_type || 'customer';
        setTimeout(() => {
          routeUser(userType);
        }, 1500);
      } catch (error) {
        // Not logged in or public access
        navigate(createPageUrl('CustomerPortal'));
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [navigate]);

  const routeUser = (userType) => {
    switch(userType) {
      case 'technician':
        navigate(createPageUrl('FieldTech'));
        break;
      case 'parts_specialist':
        navigate(createPageUrl('PartsInventory'));
        break;
      case 'bookkeeper':
        navigate(createPageUrl('Invoices'));
        break;
      case 'admin':
        navigate(createPageUrl('Dashboard'));
        break;
      case 'customer':
      default:
        navigate(createPageUrl('CustomerPortal'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const roles = [
    {
      type: 'technician',
      icon: Wrench,
      title: 'Field Technician',
      description: 'Access service reports, customer info, and mobile tools',
      color: 'bg-amber-500'
    },
    {
      type: 'parts_specialist',
      icon: Package,
      title: 'Parts Specialist',
      description: 'Manage inventory, orders, and parts availability',
      color: 'bg-blue-500'
    },
    {
      type: 'bookkeeper',
      icon: Calculator,
      title: 'Bookkeeper',
      description: 'Handle invoices, payments, and financial records',
      color: 'bg-green-500'
    },
    {
      type: 'admin',
      icon: Shield,
      title: 'Administrator',
      description: 'Full system access and management',
      color: 'bg-purple-500'
    },
    {
      type: 'customer',
      icon: Building2,
      title: 'Customer Portal',
      description: 'View service history, invoices, and communicate',
      color: 'bg-slate-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Wrench className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Welcome to DieselTech</h1>
          <p className="text-slate-400 text-lg">Field Service Management System</p>
          {user && (
            <p className="text-amber-500 mt-2">
              Hello, {user.full_name || user.email}
            </p>
          )}
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            const isCurrentRole = user?.user_type === role.type;
            
            return (
              <Card 
                key={role.type}
                className={`border-0 bg-slate-800/50 backdrop-blur-sm hover:bg-slate-800 transition-all cursor-pointer group ${
                  isCurrentRole ? 'ring-2 ring-amber-500' : ''
                }`}
                onClick={() => routeUser(role.type)}
              >
                <CardContent className="p-6">
                  <div className={`w-14 h-14 ${role.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{role.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{role.description}</p>
                  <div className="flex items-center text-amber-500 text-sm font-medium">
                    <span>Enter</span>
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                  {isCurrentRole && (
                    <div className="mt-3 text-xs text-amber-500">
                      Redirecting...
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={() => base44.auth.logout()}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}