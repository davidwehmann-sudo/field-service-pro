import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function CustomerLocationMap({ customer }) {
  const [mapUrl, setMapUrl] = useState('');
  const apiKey = 'GOOGLE_MAPS_API_KEY'; // Will be replaced at runtime

  useEffect(() => {
    if (customer?.address && customer?.city && customer?.state) {
      const address = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip || ''}`;
      const encodedAddress = encodeURIComponent(address);
      setMapUrl(`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodedAddress}`);
    }
  }, [customer, apiKey]);

  if (!customer?.address) {
    return null;
  }

  const fullAddress = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip || ''}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-900">Location</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(directionsUrl, '_blank')}
          >
            <Navigation className="w-4 h-4 mr-1" />
            Directions
          </Button>
        </div>
        
        <p className="text-sm text-slate-600 mb-3">{fullAddress}</p>
        
        {mapUrl && (
          <div className="relative w-full h-64 bg-slate-100 rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={mapUrl}
              allowFullScreen
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}