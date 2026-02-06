import React, { useState } from 'react';
import { HelpCircle, Shield, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const benefitInfo = {
  photos_initial: {
    title: "Initial Condition Photos",
    benefit: "This protects YOU! Photos provide irrefutable evidence of the equipment's condition BEFORE you started work. This prevents finger-pointing and proves the state of the equipment when you arrived.",
    icon: Shield,
    color: "text-green-600"
  },
  photos_failure: {
    title: "Component Failure Photos",
    benefit: "Document exactly what failed! Clear photos of broken components prove what was damaged and justify repairs. This protects you from disputes about what work was actually necessary.",
    icon: Shield,
    color: "text-blue-600"
  },
  location_data: {
    title: "Location Verification",
    benefit: "Prove you were there! This feature automatically verifies you were on-site at a specific time, protecting you from false claims of delays or not showing up. It's an automatic, indisputable record of your presence.",
    icon: Shield,
    color: "text-purple-600"
  },
  verification_source: {
    title: "Part Verification Source",
    benefit: "Cover yourself! Documenting where you verified part specifications protects you from warranty claims or accusations of using wrong parts. It shows you did your due diligence.",
    icon: Shield,
    color: "text-amber-600"
  },
  customer_signature: {
    title: "Customer Signature",
    benefit: "Get paid! A customer signature proves work was completed and accepted. It prevents payment disputes and ensures you get compensated for your time and effort.",
    icon: Shield,
    color: "text-teal-600"
  }
};

export default function FieldBenefitInfo({ field, children }) {
  const [open, setOpen] = useState(false);
  const info = benefitInfo[field];

  if (!info) return children;

  const Icon = info.icon;

  return (
    <div className="flex items-center gap-2">
      {children}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-6 w-6 rounded-full"
            type="button"
          >
            <HelpCircle className={`h-4 w-4 ${info.color}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" side="top">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${info.color}`} />
              <h4 className="font-semibold text-sm">{info.title}</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {info.benefit}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-md p-2">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>This documentation protects you in legal disputes</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}