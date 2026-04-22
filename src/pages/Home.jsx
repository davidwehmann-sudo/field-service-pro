import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2 } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    
    const loadAndRoute = async () => {
      try {
        const currentUser = await base44.auth.me();
        
        if (!mounted) return;
        
        // Auto-route based on user type
        switch(currentUser.user_type) {
          case 'service_technician':
            navigate(createPageUrl('FieldTech'), { replace: true });
            break;
          case 'parts_specialist':
            navigate(createPageUrl('PartsInventory'), { replace: true });
            break;
          case 'bookkeeper':
            navigate(createPageUrl('Invoices'), { replace: true });
            break;
          case 'unassigned_user':
            // Customers land on the service request form
            navigate(createPageUrl('RequestAuthorization'), { replace: true });
            break;
          case 'software_engineer':
          case 'service_admin':
          default:
            navigate(createPageUrl('Dashboard'), { replace: true });
        }
      } catch (error) {
        if (!mounted) return;
        // Not logged in - redirect to login with a simple target
        const targetUrl = window.location.origin + createPageUrl('Dashboard');
        window.location.href = `/login?from_url=${encodeURIComponent(targetUrl)}`;
      }
    };
    
    loadAndRoute();
    
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}