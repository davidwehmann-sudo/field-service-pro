import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2, Lock, Wrench } from 'lucide-react';

const STAFF_TYPES = [
  'service_technician',
  'parts_specialist',
  'bookkeeper',
  'software_engineer',
  'service_admin',
];

export default function StaffOnlyRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    base44.auth.me()
      .then(user => {
        if (STAFF_TYPES.includes(user?.user_type)) {
          setStatus('allowed');
        } else {
          setStatus('denied');
        }
      })
      .catch(() => setStatus('denied'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to={createPageUrl('RequestAuthorization')} replace />;
  }

  return children;
}