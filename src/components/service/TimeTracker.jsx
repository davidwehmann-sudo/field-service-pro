import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, Plus, Trash2, Timer } from "lucide-react";
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';

export default function TimeTracker({ entries = [], onChange, currentUser }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    start_time: '',
    end_time: '',
    description: ''
  });

  // Timer effect
  useEffect(() => {
    let interval;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const formatElapsed = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    if (!isTracking) {
      // Start tracking
      setStartTime(Date.now());
      setElapsed(0);
      setIsTracking(true);
    } else {
      // Stop tracking and create entry
      const endTime = Date.now();
      const hours = parseFloat((elapsed / 3600).toFixed(2));
      
      const newEntry = {
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        hours,
        description: '',
        technician: currentUser?.full_name || currentUser?.email || 'Technician'
      };
      
      onChange([...entries, newEntry]);
      setIsTracking(false);
      setStartTime(null);
      setElapsed(0);
    }
  };

  const handleManualAdd = () => {
    if (!manualEntry.start_time || !manualEntry.end_time) return;
    
    const start = new Date(manualEntry.start_time);
    const end = new Date(manualEntry.end_time);
    
    if (end <= start) {
      alert('End time must be after start time');
      return;
    }
    
    const hours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
    
    if (hours <= 0) return;
    
    const newEntry = {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      hours,
      description: manualEntry.description,
      technician: currentUser?.full_name || currentUser?.email || 'Technician'
    };
    
    onChange([...entries, newEntry]);
    setManualEntry({ start_time: '', end_time: '', description: '' });
    setShowManualEntry(false);
  };

  const handleDelete = (index) => {
    if (window.confirm('Delete this time entry?')) {
      onChange(entries.filter((_, i) => i !== index));
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Time Tracking</CardTitle>
              <p className="text-sm text-slate-500">Log hours worked on this repair</p>
            </div>
          </div>
          <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
            {totalHours.toFixed(2)} hrs
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer */}
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-6 border border-blue-100">
          <div className="text-center mb-4">
            <div className="text-4xl font-mono font-bold text-slate-900 mb-2">
              {formatElapsed(elapsed)}
            </div>
            {isTracking && startTime && (
              <p className="text-sm text-slate-500">
                Started at {format(new Date(startTime), 'h:mm a')}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleStartStop}
              className={`flex-1 ${isTracking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isTracking ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop & Save
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Timer
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowManualEntry(!showManualEntry)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Manual Entry Form */}
        {showManualEntry && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input
                  type="datetime-local"
                  value={manualEntry.start_time}
                  onChange={(e) => setManualEntry({ ...manualEntry, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">End Time</Label>
                <Input
                  type="datetime-local"
                  value={manualEntry.end_time}
                  onChange={(e) => setManualEntry({ ...manualEntry, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description (Optional)</Label>
              <Textarea
                value={manualEntry.description}
                onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
                placeholder="What did you work on?"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleManualAdd} disabled={!manualEntry.start_time || !manualEntry.end_time}>
                Add Entry
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowManualEntry(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Time Entries List */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Time Entries</Label>
            {entries.map((entry, index) => (
              <div key={index} className="flex items-start justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-900">{entry.hours.toFixed(2)} hours</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {format(new Date(entry.start_time), 'MMM d, h:mm a')} → {format(new Date(entry.end_time), 'h:mm a')}
                  </p>
                  {entry.description && (
                    <p className="text-sm text-slate-600 mt-1">{entry.description}</p>
                  )}
                  {entry.technician && (
                    <p className="text-xs text-slate-400 mt-1">by {entry.technician}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(index)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}