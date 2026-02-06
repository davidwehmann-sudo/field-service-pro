import React from 'react';
import { AlertTriangle, Shield, Camera, MapPin, FileText, Droplet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function LitigationProtectionWarning({ open, onOpenChange, missingFields, onProceed, onGoBack }) {
  const fieldLabels = {
    photos_initial: { label: 'Initial Condition Photos', icon: Camera, description: 'Proves equipment condition upon arrival' },
    photos_failure: { label: 'Component Failure Photos', icon: Camera, description: 'Documents what was broken/damaged' },
    fluid_samples: { label: 'Fluid Sample Documentation', icon: Droplet, description: 'Tracks contamination or fluid issues' },
    fluid_analysis_results_url: { label: 'Lab Analysis Report', icon: FileText, description: 'Professional analysis of fluid condition' },
    photos_fluid_evidence: { label: 'Fluid Evidence Photos', icon: Camera, description: 'Visual proof of contamination/glitter/discoloration' },
    location_data: { label: 'Location Verification', icon: MapPin, description: 'GPS proof you were on-site' },
    customer_signature: { label: 'Customer Signature', icon: FileText, description: 'Customer acknowledgment of work completion' }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Missing Litigation Protection Fields
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            The following documentation fields are empty. These fields are important for legal protection and defending against disputes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-amber-900">
                  Missing documentation:
                </p>
                <div className="space-y-2">
                  {missingFields.map(field => {
                    const info = fieldLabels[field];
                    if (!info) return null;
                    const Icon = info.icon;
                    return (
                      <div key={field} className="flex items-start gap-2 text-sm">
                        <Icon className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-amber-900">{info.label}</span>
                          <p className="text-amber-700 text-xs">{info.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  If a field isn't applicable or couldn't be filled:
                </p>
                <p className="text-sm text-blue-800">
                  Document the reason in the <strong>"Additional Notes"</strong> or <strong>"Technician Notes"</strong> section. 
                  For example: <em>"No failure photos - software update only"</em> or <em>"Unable to capture location - no GPS signal at remote site"</em>
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  This written explanation protects you by showing the omission was intentional and justified, not an oversight.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-700">
                  <strong>Why this matters:</strong> In legal disputes or warranty claims, this documentation proves what you did, when you did it, and what condition the equipment was in. Missing documentation can make it harder to defend your work.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onGoBack}
            className="w-full sm:w-auto"
          >
            Go Back to Edit
          </Button>
          <Button
            onClick={onProceed}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
          >
            Proceed Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}