import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Upload, Droplet, Shield } from "lucide-react";
import PhotoUpload from '@/components/service/PhotoUpload';
import FieldBenefitInfo from '@/components/service/FieldBenefitInfo';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function FluidSamplingSection({ samples = [], analysisUrl = '', photos = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleAddSample = () => {
    onChange({
      samples: [...samples, { type: '', location: '', sample_id: '' }],
      analysisUrl,
      photos
    });
  };

  const handleRemoveSample = (index) => {
    onChange({
      samples: samples.filter((_, i) => i !== index),
      analysisUrl,
      photos
    });
  };

  const handleSampleChange = (index, field, value) => {
    const updated = samples.map((sample, i) => 
      i === index ? { ...sample, [field]: value } : sample
    );
    onChange({ samples: updated, analysisUrl, photos });
  };

  const handleAnalysisUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange({ samples, analysisUrl: file_url, photos });
      toast.success('Lab report uploaded');
    } catch (error) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotosChange = (newPhotos) => {
    onChange({ samples, analysisUrl, photos: newPhotos });
  };

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-blue-600">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Droplet className="w-5 h-5 text-blue-600" />
          Fluid Sampling & Analysis
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          Document fluid samples for diagnostics and litigation defense
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fluid Samples List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="font-semibold">Samples Taken</Label>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAddSample}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Sample
            </Button>
          </div>
          
          {samples.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed rounded-lg text-slate-400">
              <Droplet className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No fluid samples recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {samples.map((sample, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">Sample {index + 1}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSample(index)}
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Fluid Type *</Label>
                      <Input
                        value={sample.type}
                        onChange={(e) => handleSampleChange(index, 'type', e.target.value)}
                        placeholder="Engine oil, hydraulic fluid..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sample Location *</Label>
                      <Input
                        value={sample.location}
                        onChange={(e) => handleSampleChange(index, 'location', e.target.value)}
                        placeholder="Engine sump, transmission..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sample ID</Label>
                      <Input
                        value={sample.sample_id}
                        onChange={(e) => handleSampleChange(index, 'sample_id', e.target.value)}
                        placeholder="Lab reference number"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lab Analysis Report */}
        <div>
          <Label className="mb-2 block font-semibold">Lab Analysis Report</Label>
          <p className="text-xs text-slate-600 mb-3">
            📄 Upload the laboratory analysis report (PDF)
          </p>
          {analysisUrl ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Lab report uploaded</p>
                <a 
                  href={analysisUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:underline"
                >
                  View report
                </a>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange({ samples, analysisUrl: '', photos })}
                className="text-red-600 hover:text-red-700"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <input
                type="file"
                id="lab-report-upload"
                accept=".pdf,.doc,.docx"
                onChange={handleAnalysisUpload}
                className="hidden"
              />
              <label htmlFor="lab-report-upload">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  className="w-full gap-2"
                  onClick={() => document.getElementById('lab-report-upload').click()}
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Lab Report
                    </>
                  )}
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Fluid Evidence Photos */}
        <div>
          <FieldBenefitInfo field="photos_fluid_evidence">
            <Label className="mb-2 block font-semibold">Fluid Condition Photos</Label>
          </FieldBenefitInfo>
          <p className="text-xs text-slate-600 mb-3">
            📸 Photos of fluid condition or sample location - document contamination, glitter in oil, discoloration, etc.
          </p>
          <PhotoUpload 
            photos={photos}
            onChange={handlePhotosChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}