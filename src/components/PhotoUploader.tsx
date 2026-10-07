import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { apiService } from '../services/apiService';
import { VehicleImage } from './ui/CommonUI';

interface PhotoUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** Minimum photos that must remain (default 1) — the last one can't be removed. */
  minImages?: number;
  maxImages?: number;
  label?: string;
  onError?: (message: string) => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // matches backend/api/uploads/upload.php

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  images,
  onChange,
  minImages = 1,
  maxImages = 8,
  label = 'Vehicle photos',
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const reportError = (message: string) => {
    setLocalError(message);
    onError?.(message);
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLocalError(null);

    const files = Array.from(fileList).slice(
      0,
      Math.max(0, maxImages - images.length)
    );

    if (files.length === 0) {
      reportError(`You can upload up to ${maxImages} photos.`);
      return;
    }

    for (const file of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        reportError('Only JPG, PNG, or WEBP photos are allowed.');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        reportError(`"${file.name}" is larger than 5 MB.`);
        return;
      }
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        // Sequential (not parallel) so a single failure is easy to attribute
        // and we don't hammer the PHP upload endpoint with concurrent writes.
        const url = await apiService.uploadFile(file);
        uploadedUrls.push(url);
      }
      onChange([...images, ...uploadedUrls]);
    } catch (err) {
      reportError(
        err instanceof Error ? err.message : 'Failed to upload photo.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (idx: number) => {
    if (images.length <= minImages) {
      reportError(`At least ${minImages} photo is required.`);
      return;
    }
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-zinc-700">
        {label}
      </span>

      <div className="flex flex-wrap gap-2.5">
        {images.map((img, idx) => (
          <div
            key={`${img}-${idx}`}
            className="relative w-24 h-20 rounded-lg overflow-hidden border border-zinc-200 group"
          >
            <VehicleImage
              src={img}
              alt={`Vehicle photo ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-zinc-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Remove photo"
            >
              <X className="w-3 h-3" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/90 text-zinc-700">
                Cover
              </span>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-20 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-zinc-400 hover:text-zinc-500 transition-colors cursor-pointer disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            <span className="text-[10px] font-medium">
              {uploading ? 'Uploading…' : 'Add photo'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <p className="text-[11px] text-zinc-500">
        JPG, PNG, or WEBP. Up to {maxImages} photos, 5 MB each. The first
        photo is used as the cover image.
      </p>

      {localError && (
        <p className="text-xs text-red-600">{localError}</p>
      )}
    </div>
  );
};
