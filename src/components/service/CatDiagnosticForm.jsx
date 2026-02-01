import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";

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
  },
  {
    step: 7,
    title: "Document [concern], [analysis], & [repair]",
    field: "step7_document",
    placeholder: "Comprehensive documentation of the concern, analysis performed, and repairs completed..."
  }
];

export default function CatDiagnosticForm({ diagnostic = {}, onChange }) {
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
              <span className="text-amber-700 font-bold text-lg">7</span>
            </div>
            <div>
              <CardTitle className="text-lg">CAT 7-Step Diagnostic</CardTitle>
              <p className="text-sm text-slate-500">Caterpillar systematic troubleshooting</p>
            </div>
          </div>
          <Badge 
            className={completedSteps === 7 
              ? "bg-green-100 text-green-700" 
              : "bg-slate-100 text-slate-600"
            }
          >
            {completedSteps}/7 Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {DIAGNOSTIC_STEPS.map((step) => {
          const isCompleted = diagnostic[step.field]?.trim();
          return (
            <div key={step.step} className="space-y-2">
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}