import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import PhotoUpload from './PhotoUpload';
import FluidSamplingSection from './FluidSamplingSection';

const DIAGNOSTIC_STEPS = [
  {
    step: 1,
    title: "Verify Customer Complaint",
    field: "step1_verify_complaint",
    placeholder: "Confirm and verify the customer's complaint. What is the actual problem? Does it match the customer's description?"
  },
  {
    step: 2,
    title: "Conduct Initial Inspection",
    field: "step2_initial_inspection",
    placeholder: "Perform initial visual inspection. Document findings and take pictures as necessary..."
  },
  {
    step: 3,
    title: "List Possible Causes",
    field: "step3_list_causes",
    placeholder: "Based on inspection and complaint, list all potential causes of the problem..."
  },
  {
    step: 4,
    title: "Analyze Possible Causes / Determine Root Cause",
    field: "step4_analyze_causes",
    placeholder: "Analyze each possible cause through testing, measurements, and diagnostics. Determine the root cause..."
  },
  {
    step: 5,
    title: "Repair Root Cause",
    field: "step5_repair",
    placeholder: "Execute repairs to address the root cause. Detail all work performed..."
  },
  {
    step: 6,
    title: "Verify Repair",
    field: "step6_verify_repair",
    placeholder: "Test and verify that the repair resolved the issue. Take pictures as necessary to document successful repair..."
  }
];

export default function CatDiagnosticForm({ 
  diagnostic = {}, 
  onChange,
  // Evidence fields integrated into workflow
  photosInitial = [],
  onPhotosInitialChange,
  photos = [],
  onPhotosChange,
  photosFailure = [],
  onPhotosFailureChange,
  safetyPrecisionNotes = '',
  onSafetyPrecisionNotesChange,
  // Fluid sampling
  fluidSamples = [],
  fluidAnalysisUrl = '',
  fluidPhotos = [],
  onFluidDataChange
}) {
  const handleChange = (field, value) => {
    onChange({ ...diagnostic, [field]: value });
  };

  const completedSteps = DIAGNOSTIC_STEPS.filter(s => diagnostic[s.field]?.trim()).length;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <span className="text-amber-700 font-bold text-lg">6</span>
            </div>
            <div>
              <CardTitle className="text-lg">CAT Diagnostic Process</CardTitle>
              <p className="text-sm text-slate-500">Steps 1-6 of Caterpillar 7-Step (Step 7 is the report itself)</p>
            </div>
          </div>
          <Badge 
            className={completedSteps === 6 
              ? "bg-green-100 text-green-700" 
              : "bg-slate-100 text-slate-600"
            }
          >
            {completedSteps}/6 Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {DIAGNOSTIC_STEPS.map((step) => {
          const isCompleted = diagnostic[step.field]?.trim();
          return (
            <div key={step.step} className="space-y-3 pb-6 border-b border-slate-200 last:border-0 last:pb-0">
              <Label className="flex items-center gap-2">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300" />
                )}
                <span className="text-amber-600 font-semibold">Step {step.step}:</span>
                <span>{step.title}</span>
              </Label>
              <Textarea
                value={diagnostic[step.field] || ''}
                onChange={(e) => handleChange(step.field, e.target.value)}
                placeholder={step.placeholder}
                rows={2}
                className={isCompleted ? "border-green-200 bg-green-50/50" : ""}
              />
              
              {/* Step 2: Initial Inspection - Add photos */}
              {step.step === 2 && (
                <div className="mt-3 space-y-3 pl-6 border-l-2 border-amber-200">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      📸 Initial Condition Photos
                    </Label>
                    <p className="text-xs text-slate-600 mb-2">
                      Photos BEFORE starting work - proves pre-existing condition
                    </p>
                    <PhotoUpload 
                      photos={photosInitial}
                      onChange={onPhotosInitialChange}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      Additional Inspection Photos
                    </Label>
                    <PhotoUpload 
                      photos={photos}
                      onChange={onPhotosChange}
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Analyze Causes - Add safety notes and fluid sampling */}
              {step.step === 4 && (
                <div className="mt-3 space-y-4 pl-6 border-l-2 border-amber-200">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      ⚖️ Safety & Precision Measurements
                    </Label>
                    <p className="text-xs text-slate-600 mb-2">
                      Document weights, torque specs, clearances, and calibrated tool usage
                    </p>
                    <Textarea
                      value={safetyPrecisionNotes}
                      onChange={(e) => onSafetyPrecisionNotesChange(e.target.value)}
                      placeholder="Example: Component weight 500 lbs × 3 block = 1500 lbs. Torqued to 185 ft-lbs per spec. Used calibrated Snap-on torque wrench."
                      rows={3}
                    />
                  </div>
                  
                  <div className="-ml-6">
                    <FluidSamplingSection
                      samples={fluidSamples}
                      analysisUrl={fluidAnalysisUrl}
                      photos={fluidPhotos}
                      onChange={onFluidDataChange}
                    />
                  </div>
                </div>
              )}

              {/* Step 6: Verify Repair - Add failure photos */}
              {step.step === 6 && (
                <div className="mt-3 pl-6 border-l-2 border-amber-200">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    📸 Component Failure & Verification Photos
                  </Label>
                  <p className="text-xs text-slate-600 mb-2">
                    Document failed/broken components and successful repair
                  </p>
                  <PhotoUpload 
                    photos={photosFailure}
                    onChange={onPhotosFailureChange}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}