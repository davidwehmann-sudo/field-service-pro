import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function NatureOfServiceInput({ value, onChange }) {
  const [aiInput, setAiInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAiHelp = async () => {
    if (!aiInput.trim()) {
      toast.error("Please describe the issue first");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Transform this into a professional service authorization description (2-4 sentences, technical but clear): "${aiInput}"`
      });

      onChange(response);
      setAiInput('');
      toast.success("Description generated");
    } catch (error) {
      toast.error("Failed to generate description");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Nature of Service *</Label>
      
      {/* AI Helper */}
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900 text-sm">AI Writing Assistant</p>
            <p className="text-xs text-slate-600">Describe the issue in your own words - AI will translate it into detailed technical language for the service authorization</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <Textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="E.g., Engine won't start, makes clicking noise, battery is new..."
            rows={2}
            className="bg-white"
            disabled={isGenerating}
          />
          <Button
            type="button"
            onClick={handleAiHelp}
            disabled={isGenerating || !aiInput.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Professional Description
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Manual Input */}
      <div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe what equipment/system needs service and the nature of the problem..."
          rows={4}
          className={value ? "border-green-200 bg-green-50/30" : ""}
        />
        {value && (
          <div className="flex items-center gap-1 mt-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            Description ready (you can edit if needed)
          </div>
        )}
      </div>
    </div>
  );
}