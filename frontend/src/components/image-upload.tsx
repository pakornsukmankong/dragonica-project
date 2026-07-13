'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/toast';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  className?: string;
}

export function ImageUpload({ currentUrl, onUploaded, className = '' }: ImageUploadProps) {
  const t = useTranslations('imageUpload');
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Images only, capped at 5 MB — mirrors the bucket's server-side limits
    // (migration 010) so bad files fail fast with a friendly message.
    const allowed: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const mimeExt = allowed[file.type];
    if (!mimeExt || file.size > 5 * 1024 * 1024) {
      toast({ title: t('invalidFile'), variant: 'error' });
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase Storage directly. The extension comes from the MIME
    // type, never from the user-supplied filename.
    setIsUploading(true);
    try {
      const supabase = createClient();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${mimeExt}`;
      const path = `images/${filename}`;

      const { error } = await supabase.storage
        .from('assets')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from('assets').getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (err) {
      setPreview(currentUrl ?? null);
      toast({
        title: t('uploadFailed'),
        description: (err as Error).message,
        variant: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob/data URL preview; next/image can't optimize these
        <img
          src={preview}
          alt="Preview"
          className="w-10 h-10 rounded-base object-cover outline outline-1 outline-[rgba(255,255,255,0.08)]"
        />
      ) : (
        <div className="w-10 h-10 rounded-base bg-raised flex items-center justify-center outline outline-1 outline-[rgba(255,255,255,0.08)]">
          <Camera className="w-4 h-4 text-muted" />
        </div>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isUploading}
        className="flex items-center gap-1.5 rounded-base px-3 py-1.5 text-xs font-medium text-foreground border border-border hover:bg-raised transition-colors duration-150 disabled:opacity-50"
      >
        <Upload className="w-3 h-3" />
        {isUploading ? t('uploading') : preview ? t('change') : t('upload')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
