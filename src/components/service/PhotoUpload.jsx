import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function PhotoUpload({ photos = [], onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map(r => r.file_url);
      onChange([...photos, ...newUrls]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((url, index) => (
          <div key={index} className="relative group">
            <img 
              src={url} 
              alt={`Photo ${index + 1}`} 
              className="w-20 h-20 object-cover rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        
        <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all">
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <>
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="text-xs text-slate-400 mt-1">Add</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}