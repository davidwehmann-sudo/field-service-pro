import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Badge variant="destructive" className="flex items-center gap-2">
      <WifiOff className="w-3 h-3" />
      Offline - Changes saved locally
    </Badge>
  );
}