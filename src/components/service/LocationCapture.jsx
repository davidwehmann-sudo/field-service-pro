import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LocationCapture({ value, onChange }) {
  const [capturing, setCapturing] = useState(false);

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your device');
      return;
    }

    setCapturing(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      onChange(locationData);
      toast.success(`Location captured (±${Math.round(locationData.accuracy)}m accuracy)`);
    } catch (error) {
      toast.error('Failed to capture location: ' + error.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-3">
      {!value ? (
        <Button
          type="button"
          variant="outline"
          onClick={captureLocation}
          disabled={capturing}
          className="w-full gap-2"
        >
          {capturing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Capturing location...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              Capture Service Location
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4" />
            <div className="flex-1">
              <p className="font-medium">Location Verified</p>
              <p className="text-xs text-green-600">
                {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
              </p>
              <p className="text-xs text-green-600">
                Captured: {new Date(value.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={captureLocation}
            disabled={capturing}
            className="w-full text-xs"
          >
            Update Location
          </Button>
        </div>
      )}
    </div>
  );
}