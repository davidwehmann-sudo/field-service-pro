import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, Camera, Clock, Package, 
  Activity, Wrench, ChevronDown, ChevronUp, User
} from 'lucide-react';

const TYPE_CONFIG = {
  notes:      { icon: MessageSquare, color: 'bg-blue-100 text-blue-700',    label: 'Notes',      border: 'border-blue-200' },
  photos:     { icon: Camera,        color: 'bg-purple-100 text-purple-700', label: 'Photos',     border: 'border-purple-200' },
  labor:      { icon: Clock,         color: 'bg-green-100 text-green-700',   label: 'Labor',      border: 'border-green-200' },
  parts:      { icon: Package,       color: 'bg-amber-100 text-amber-700',   label: 'Parts',      border: 'border-amber-200' },
  diagnostic: { icon: Activity,      color: 'bg-rose-100 text-rose-700',     label: 'Diagnostic', border: 'border-rose-200' },
  status:     { icon: Wrench,        color: 'bg-slate-100 text-slate-700',   label: 'Status',     border: 'border-slate-200' },
  other:      { icon: MessageSquare, color: 'bg-slate-100 text-slate-700',   label: 'Note',       border: 'border-slate-200' },
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function AvatarBadge({ name }) {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-amber-500',
    'bg-rose-500', 'bg-purple-500', 'bg-cyan-500',
  ];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function EntryContent({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const { type, content } = entry;

  if (type === 'notes' || type === 'other') {
    const text = content?.text || '';
    const isLong = text.length > 300;
    return (
      <div>
        <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${isLong && !expanded ? 'line-clamp-4' : ''}`}>
          {text}
        </p>
        {isLong && (
          <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs text-blue-600 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <><ChevronUp className="w-3 h-3 mr-1" />Show less</> : <><ChevronDown className="w-3 h-3 mr-1" />Show more</>}
          </Button>
        )}
      </div>
    );
  }

  if (type === 'photos') {
    const urls = content?.urls || [];
    return (
      <div>
        {content?.caption && <p className="text-sm text-slate-600 mb-2">{content.caption}</p>}
        <div className="flex flex-wrap gap-2">
          {urls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`Photo ${i+1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'labor') {
    const items = content?.items || [];
    return (
      <div className="space-y-1">
        {content?.description && <p className="text-sm text-slate-600 mb-1">{content.description}</p>}
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm bg-green-50 rounded px-2 py-1">
            <span className="text-slate-700">{item.description}</span>
            <span className="font-mono text-green-700 font-medium">{item.hours}h @ ${item.rate}/hr = ${(item.total || item.hours * item.rate || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'parts') {
    const items = content?.items || [];
    return (
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm bg-amber-50 rounded px-2 py-1">
            <span className="text-slate-700">{item.description}{item.part_number ? ` (${item.part_number})` : ''}</span>
            <span className="font-mono text-amber-700 font-medium">Qty: {item.quantity}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'diagnostic') {
    const steps = content?.steps || {};
    return (
      <div className="space-y-2 text-sm">
        {Object.entries(steps).filter(([,v]) => v).map(([key, val]) => (
          <div key={key}>
            <span className="font-medium text-slate-600 capitalize">{key.replace(/_/g, ' ')}: </span>
            <span className="text-slate-700">{val}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'status') {
    return (
      <p className="text-sm text-slate-700">
        Status changed to{' '}
        <Badge variant="outline" className="font-mono">{content?.status}</Badge>
        {content?.note && <span className="ml-2 text-slate-500">— {content.note}</span>}
      </p>
    );
  }

  return <pre className="text-xs text-slate-500 bg-slate-50 rounded p-2 overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
}

export default function ActivityTimeline({ entries = [], currentUserName }) {
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No activity yet. Add your first note above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((entry, idx) => {
        const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.other;
        const Icon = cfg.icon;
        const isOwn = entry.user_name === currentUserName;
        return (
          <div key={entry.id || idx} className="flex gap-3 group">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <AvatarBadge name={entry.user_name} />
              {idx < sorted.length - 1 && (
                <div className="w-0.5 flex-1 bg-slate-100 my-1 min-h-[1.5rem]" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 mb-4 pb-4 ${idx < sorted.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-slate-900">
                  {entry.user_name || 'Unknown Tech'}
                  {isOwn && <span className="ml-1 text-slate-400 font-normal text-xs">(you)</span>}
                </span>
                <Badge className={`text-xs px-1.5 py-0 ${cfg.color} border-0`}>
                  <Icon className="w-3 h-3 mr-1 inline" />
                  {cfg.label}
                </Badge>
                <span className="text-xs text-slate-400 ml-auto" title={format(new Date(entry.timestamp), 'PPpp')}>
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </span>
              </div>
              <EntryContent entry={entry} />
            </div>
          </div>
        );
      })}
    </div>
  );
}