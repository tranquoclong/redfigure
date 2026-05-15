"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GalleryPicker, type GalleryMedia } from "./gallery-picker";

type WebpVariant = "thumb" | "card" | "gallery" | "full";
type AspectRatio = "square" | "1200x630" | "auto";

interface ImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;

  variant?: WebpVariant;

  aspectRatio?: AspectRatio;
  helperText?: string;
  className?: string;
  disabled?: boolean;
}

const ASPECT_CLASSES: Record<AspectRatio, string> = {
  square: "aspect-square",
  "1200x630": "aspect-[1200/630]",
  auto: "",
};

export function ImagePicker({
  value,
  onChange,
  variant = "full",
  aspectRatio = "auto",
  helperText,
  className,
  disabled = false,
}: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const media = (data.data ?? data) as GalleryMedia;
      onChange(resolveVariant(media, variant));
    } catch (err) {
      console.error("Upload thất bại:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleGalleryPick(media: GalleryMedia) {
    onChange(resolveVariant(media, variant));
  }

  function handleRemove() {
    onChange(null);
  }

  const previewClass = cn(
    "relative w-full max-w-md rounded-md border border-border/60 bg-muted/30 overflow-hidden",
    ASPECT_CLASSES[aspectRatio],
    aspectRatio === "auto" && "min-h-[120px]",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Đang tải lên..." : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setShowGallery(true)}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          Thư viện ảnh
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleRemove}
          >
            <X className="h-4 w-4 mr-2" />
            Xóa
          </Button>
        )}
      </div>

      {value && (
        <div className={previewClass}>
          {aspectRatio === "auto" ? (
            <img
              src={value}
              alt="Preview"
              className="w-full h-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Image
              src={value}
              alt="Preview"
              fill
              className="object-cover"
              sizes="500px"
              unoptimized
            />
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}

      <GalleryPicker
        open={showGallery}
        onOpenChange={setShowGallery}
        onSelect={handleGalleryPick}
      />
    </div>
  );
}

function resolveVariant(media: GalleryMedia, variant: WebpVariant): string {
  return media[variant];
}
