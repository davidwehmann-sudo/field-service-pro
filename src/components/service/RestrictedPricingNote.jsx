import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function RestrictedPricingNote() {
  return (
    <Alert className="border-amber-200 bg-amber-50">
      <Lock className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-sm text-amber-800">
        Pricing adjustments require admin or bookkeeper authorization
      </AlertDescription>
    </Alert>
  );
}