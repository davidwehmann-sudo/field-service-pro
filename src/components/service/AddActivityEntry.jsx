import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Camera, Loader2, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AddActivityEntry({ reportId, currentUser, onEntryAdded }) {
  const [type, setType] = useState('notes');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const canSubmit = text.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;

    const entry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      user_name: currentUser?.full_name || currentUser?.email || 'Unknown Tech',
      user_id: currentUser?.id || '',
      type,
      content: { text: text.trim() }
    };

    setSaving(true);
    try {
      // Fetch latest to avoid overwriting concurrent entries
      const latest = await base44.entities.ServiceReport.filter({ id: reportId });
      const current = latest?.[0];
      const existing = current?.activity_log || [];

      await base44.entities.ServiceReport.update(reportId, {
        activity_log: [...existing, entry]
      });

      setText('');
      onEntryAdded?.(entry);
      toast.success('Entry added to activity log');
    } catch (err) {
      toast.error('Failed to save entry: ' + err.message);
      // Save to localStorage as fallback
      const drafts = JSON.parse(localStorage.getItem(`activity_drafts_${reportId}`) || '[]');
      drafts.push(entry);
      localStorage.setItem(`activity_drafts_${reportId}`, JSON.stringify(drafts));
      toast.info('Entry saved locally as draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return file_url;
        })
      );

      const entry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        user_name: currentUser?.full_name || currentUser?.email || 'Unknown Tech',
        user_id: currentUser?.id || '',
        type: 'photos',
        content: { urls, caption: text.trim() || undefined }
      };

      const latest = await base44.entities.ServiceReport.filter({ id: reportId });
      const current = latest?.[0];
      const existing = current?.activity_log || [];

      await base44.entities.ServiceReport.update(reportId, {
        activity_log: [...existing, entry]
      });

      setText('');
      onEntryAdded?.(entry);
      toast.success(`${urls.length} photo(s) added to activity log`);
    } catch (err) {
      toast.error('Photo upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Add Progress Update</span>
        {currentUser && (
          <Badge variant="outline" className="text-xs ml-auto">
            {currentUser.full_name || currentUser.email}
          </Badge>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="notes">📝 Notes</SelectItem>
            <SelectItem value="diagnostic">🔍 Diagnostic</SelectItem>
            <SelectItem value="labor">⏱ Labor Update</SelectItem>
            <SelectItem value="parts">📦 Parts Used</SelectItem>
            <SelectItem value="other">💬 Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          type === 'notes'      ? 'What did you find, fix, or observe? Be specific...' :
          type === 'diagnostic' ? 'Describe diagnostic steps, findings, root cause analysis...' :
          type === 'labor'      ? 'Describe the labor performed, hours worked, rate...' :
          type === 'parts'      ? 'List parts used, part numbers, quantities...' :
          'Add any relevant information...'
        }
        rows={4}
        className="text-sm font-mono resize-none mb-3"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
        }}
      />

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {saving ? 'Saving...' : 'Post Update'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || saving}
          className="gap-1.5"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading...' : 'Add Photos'}
        </Button>
        <input type="file" ref={fileRef} accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />

        <span className="text-xs text-slate-400 ml-auto hidden sm:block">Ctrl+Enter to post</span>
      </div>
    </div>
  );
}