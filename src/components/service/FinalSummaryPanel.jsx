import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function FinalSummaryPanel({ reportId, value, activityLog = [], onChange, onMarkComplete, isSaving }) {
  const [generating, setGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const logText = activityLog.map(entry =>
        `[${entry.user_name} — ${entry.type}] ${
          entry.content?.text ||
          (entry.content?.items?.map(i => i.description).join(', ')) ||
          (entry.content?.urls ? `${entry.content.urls.length} photos` : '') ||
          ''
        }`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a field service documentation assistant. Based on the following activity log entries from one or more technicians, write a concise, professional final service summary suitable for an invoice. Include: what was wrong, what was done to fix it, and the outcome. Keep it under 200 words. Activity log:\n\n${logText}`,
      });

      if (result) {
        onChange(result);
        toast.success('Summary generated from activity log');
      }
    } catch (err) {
      toast.error('Failed to generate summary: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const logCount = activityLog.length;

  return (
    <Card className="border-2 border-green-200 bg-green-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-700" />
            Final Summary
            <Badge variant="outline" className="text-xs text-green-700 border-green-300">
              For invoicing
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoGenerate}
            disabled={generating || logCount === 0}
            className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? 'Generating...' : 'Auto-generate from Log'}
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Written by the lead technician when closing the report. This appears on invoices and PDFs.
          {logCount > 0 && <span className="text-green-700 font-medium"> ({logCount} activity entries to summarize)</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write a clear, concise summary of the work performed. Include: customer complaint, root cause found, repair performed, and verification of fix. This will appear on the customer's invoice."
          rows={8}
          className="bg-white font-mono text-sm"
        />

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={onMarkComplete}
            disabled={isSaving || !value?.trim()}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSaving ? 'Completing...' : 'Mark Complete & Ready to Invoice'}
          </Button>
          {!value?.trim() && (
            <p className="text-xs text-amber-600">⚠️ Final summary required before marking complete</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}