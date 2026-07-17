"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { uploadGalleryImage, deleteGalleryImage, updateGalleryImage } from "@/lib/actions/gallery";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

interface GalleryImageRow {
  id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  alt_text: string;
  image_type: string | null;
  sort_order: number | null;
  storage_path: string;
}

interface Props {
  projectId: string;
  initialImages: GalleryImageRow[];
}

const IMAGE_TYPES = [
  { value: "general", label: "General" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "during", label: "During" },
];

export default function GalleryImageManager({ projectId, initialImages }: Props) {
  const [images, setImages] = useState<GalleryImageRow[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
    const valid = Array.from(files).filter(f => {
      if (!allowed.includes(f.type) && !f.type.startsWith("image/")) {
        toast.error(`${f.name} is not a supported image`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    setUploading(true);
    for (const file of valid) {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadGalleryImage(fd, projectId);
      if (result.error) {
        toast.error(`Failed to upload ${file.name}: ${result.error}`);
      } else if (result.image) {
        toast.success(`${file.name} uploaded`);
        setImages(prev => [...prev, result.image!]);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (img: GalleryImageRow) => {
    setDeletingIds(prev => new Set(prev).add(img.id));
    const result = await deleteGalleryImage(img.id, img.storage_path);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Image removed");
      setImages(prev => prev.filter(i => i.id !== img.id));
    }
    setDeletingIds(prev => { const s = new Set(prev); s.delete(img.id); return s; });
  };

  const handleTypeChange = (imgId: string, imageType: string) => {
    setImages(prev => prev.map(i => i.id === imgId ? { ...i, image_type: imageType } : i));
    startTransition(async () => {
      const result = await updateGalleryImage(imgId, { image_type: imageType });
      if (result.error) toast.error(result.error);
    });
  };

  const handleAltBlur = (imgId: string, altText: string) => {
    startTransition(async () => {
      await updateGalleryImage(imgId, { alt_text: altText });
    });
  };

  const handleCaptionBlur = (imgId: string, caption: string) => {
    startTransition(async () => {
      await updateGalleryImage(imgId, { caption: caption || undefined });
    });
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          uploading
            ? "border-gray-300 bg-gray-50 cursor-default"
            : "border-gray-200 cursor-pointer hover:border-redline/50 hover:bg-redline/5"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Loader2 size={24} className="animate-spin text-redline" />
            <span className="text-sm font-medium">Uploading…</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-charcoal">Drop images here or click to upload</p>
            <p className="text-xs text-muted mt-1">JPG, PNG, WebP — multiple files supported</p>
          </>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {images.map((img) => (
            <div key={img.id} className="space-y-2">
              {/* Thumbnail with delete overlay */}
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 group">
                <Image
                  src={img.thumbnail_url ?? img.url}
                  alt={img.alt_text ?? "Gallery image"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                  unoptimized={img.url.includes(".supabase.co")}
                />
                <button
                  onClick={() => handleDelete(img)}
                  disabled={deletingIds.has(img.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-60"
                  title="Remove image"
                >
                  {deletingIds.has(img.id)
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                </button>
                {/* Type badge */}
                <div className="absolute bottom-2 left-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {img.image_type ?? "general"}
                  </span>
                </div>
              </div>

              {/* Type select */}
              <select
                value={img.image_type ?? "general"}
                onChange={(e) => handleTypeChange(img.id, e.target.value)}
                className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-charcoal bg-white focus:border-redline focus:ring-1 focus:ring-redline/20 outline-none"
              >
                {IMAGE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* Alt text */}
              <input
                type="text"
                defaultValue={img.alt_text ?? ""}
                onBlur={(e) => handleAltBlur(img.id, e.target.value)}
                placeholder="Alt text (required for accessibility)"
                className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-charcoal placeholder:text-gray-400 focus:border-redline focus:ring-1 focus:ring-redline/20 outline-none"
              />

              {/* Caption */}
              <input
                type="text"
                defaultValue={img.caption ?? ""}
                onBlur={(e) => handleCaptionBlur(img.id, e.target.value)}
                placeholder="Caption (optional)"
                className="w-full text-xs rounded-lg border border-gray-200 px-2 py-1.5 text-charcoal placeholder:text-gray-400 focus:border-redline focus:ring-1 focus:ring-redline/20 outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        !uploading && (
          <div className="py-8 text-center">
            <ImageIcon size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-muted">No images yet — upload above to get started</p>
          </div>
        )
      )}
    </div>
  );
}
