import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';

const STAFF_TYPES = [
  'service_technician',
  'parts_specialist',
  'bookkeeper',
  'software_engineer',
  'service_admin',
];

// Module-level cache keyed by user id so it clears if user changes
let authCache = { userId: null, status: null };

export default function StaffOnlyRoute({ children }) {
  const [status, setStatus] = useState(authCache.status || 'loading');

  useEffect(() => {
    if (authCache.status) return;
    base44.auth.me()
      .then(user => {
        const result = STAFF_TYPES.includes(user?.user_type) ? 'allowed' : 'denied';
        authCache = { userId: user?.id, status: result };
        setStatus(result);
      })
      .catch(() => {
        authCache = { userId: null, status: 'denied' };
        setStatus('denied');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to={createPageUrl('RequestAuthorization')} replace />;
  }

  return children;
}