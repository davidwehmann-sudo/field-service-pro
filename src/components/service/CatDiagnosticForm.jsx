import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";

const DIAGNOSTIC_STEPS = [
  {
    step: 1,
    title: "Identify the Symptom",
    field: "step1_symptom",
    placeholder: "What is the customer complaint? What symptoms are present? When does it occur?"
  },
  {
    step: 2,
    title: "Research the Symptom",
    field: "step2_research",
    placeholder: "SIS research, troubleshooting guides consulted, known issues, TSBs reviewed..."
  },
  {
    step: 3,
    title: "Visual Inspection",
    field: "step3_visual_inspection",
    placeholder: "Physical inspection findings: leaks, damage, wear, loose connections, contamination..."
  },
  {
    step: 4,
    title: "Operational Tests",
    field: "step4_operational_tests",
    placeholder: "Tests performed: engine performance, hydraulic function, electrical checks, results..."
  },
  {
    step: 5,
    title: "Diagnostic Codes",
    field: "step5_diagnostic_codes",
    placeholder: "ET codes, flash codes, logged events, code descriptions and conditions..."
  },
  {
    step: 6,
    title: "Measurements & Tests",
    field: "step6_measurements",
    placeholder: "Pressure readings, voltage/amperage, temperatures, flow rates, tolerances..."
  },
  {
    step: 7,
    title: "Root Cause",
    field: "step7_root_cause",
    placeholder: "Confirmed root cause of the problem based on diagnostic findings..."
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