import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2 } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const loadAndRoute = async () => {
      try {
        const currentUser = await base44.auth.me();
        
        // Auto-route based on user type
        switch(currentUser.user_type) {
          case 'service_technician':
            navigate(createPageUrl('FieldTech'));
            break;
          case 'parts_specialist':
            navigate(createPageUrl('PartsInventory'));
            break;
          case 'bookkeeper':
            navigate(createPageUrl('FinancialExports'));
            break;
          case 'service_admin':
            navigate(createPageUrl('Dashboard'));
            break;
          case 'service_customer':
          default:
            navigate(createPageUrl('CustomerPortal'));
        }
      } catch (error) {
        // Not logged in - redirect to login
        base44.auth.redirectToLogin();
      }
    };
    loadAndRoute();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}