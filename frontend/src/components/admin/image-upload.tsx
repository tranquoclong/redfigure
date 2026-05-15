"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, Star, Loader2, ImageIcon, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GalleryPicker, type GalleryMedia } from "./gallery-picker";
import { CaptionPresetButton } from "./caption-preset-popover";

export interface ProductImageData {
  id?: string;
  mediaFileId: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;

  alt?: string;
  title?: string;
  description?: string;
  caption?: string;

  captionPresetId?: string | null;
  captionPresetName?: string | null;
  isMain: boolean;
  order: number;
}

interface ImageUploadProps {
  images: ProductImageData[];
  onChange: (images: ProductImageData[]) => void;

  onMediaMetaSave?: (
    mediaFileId: string,
    patch: {
      alt?: string;
      title?: string;
      description?: string;
      caption?: string;

      captionPresetId?: string | null;
    },
  ) => unknown;
}

export function ImageUpload({
  images,
  onChange,
  onMediaMetaSave,
}: ImageUploadProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const focusSnapshotRef = useRef<Map<string, string>>(new Map());

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages = [...images];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post("/media/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const media = data.data ?? data;
        newImages.push({
          mediaFileId: media.id,
          thumb: media.thumb,
          card: media.card,
          gallery: media.gallery,
          full: media.full,
          alt: media.alt ?? undefined,
          caption: media.caption ?? undefined,
          isMain: newImages.length === 0,
          order: newImages.length,
        });
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }

    onChange(newImages);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectFromGallery(media: GalleryMedia) {
    if (images.some((img) => img.mediaFileId === media.id)) return;
    onChange([
      ...images,
      {
        mediaFileId: media.id,
        thumb: media.thumb,
        card: media.card,
        gallery: media.gallery,
        full: media.full,
        alt: media.alt ?? undefined,
        title: media.title ?? undefined,
        description: media.description ?? undefined,
        caption: (media as { caption?: string | null }).caption ?? undefined,
        isMain: images.length === 0,
        order: images.length,
      },
    ]);
  }

  function selectManyFromGallery(medias: GalleryMedia[]) {
    const existing = new Set(images.map((img) => img.mediaFileId));
    const hasExistingMain = images.some((img) => img.isMain);
    const additions = medias
      .filter((m) => !existing.has(m.id))
      .map((media, offset) => ({
        mediaFileId: media.id,
        thumb: media.thumb,
        card: media.card,
        gallery: media.gallery,
        full: media.full,
        alt: media.alt ?? undefined,
        title: media.title ?? undefined,
        description: media.description ?? undefined,
        caption: (media as { caption?: string | null }).caption ?? undefined,

        isMain: !hasExistingMain && offset === 0,
        order: images.length + offset,
      }));
    if (additions.length > 0) onChange([...images, ...additions]);
  }

  function reorderImages(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const updated = [...images];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(
      updated.map((img, i) => ({
        ...img,
        isMain: i === 0,
        order: i,
      })),
    );
  }

  function setAsMain(index: number) {
    reorderImages(index, 0);
  }

  function removeImage(index: number) {
    const updated = images.filter((_, i) => i !== index);
    onChange(
      updated.map((img, i) => ({
        ...img,
        isMain: i === 0,
        order: i,
      })),
    );
  }

  function applyPresetTo(
    index: number,
    preset: { id: string; text: string; name?: string },
  ) {
    const updated = [...images];
    updated[index] = {
      ...updated[index],
      caption: preset.text,
      captionPresetId: preset.id,
      captionPresetName:
        preset.name ?? updated[index].captionPresetName ?? null,
    };
    onChange(updated);

    queryClient.invalidateQueries({ queryKey: ["gallery-picker"] });

    onMediaMetaSave?.(updated[index].mediaFileId, {
      caption: preset.text,
      captionPresetId: preset.id,
    });
  }

  function unlinkPreset(index: number) {
    const updated = [...images];
    updated[index] = {
      ...updated[index],
      captionPresetId: null,
      captionPresetName: null,
    };
    onChange(updated);

    onMediaMetaSave?.(updated[index].mediaFileId, { captionPresetId: null });
  }

  function snapshotKey(mediaFileId: string, field: string) {
    return `${mediaFileId}:${field}`;
  }

  function handleMetaFocus(
    index: number,
    field: "alt" | "title" | "description" | "caption",
    value: string,
  ) {
    focusSnapshotRef.current.set(
      snapshotKey(images[index].mediaFileId, field),
      value,
    );
  }

  function handleMetaBlur(
    index: number,
    field: "alt" | "title" | "description" | "caption",
    value: string,
  ) {
    if (!onMediaMetaSave) return;
    const key = snapshotKey(images[index].mediaFileId, field);
    const initial = focusSnapshotRef.current.get(key);
    if (initial === value) return;
    focusSnapshotRef.current.set(key, value);
    onMediaMetaSave(images[index].mediaFileId, { [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Đang tải lên..." : "Upload Mới"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowGallery(true)}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          Chọn từ Thư viện Ảnh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Hình ảnh sẽ được chuyển đổi sang WebP với 4 kích thước. Thuộc tính
        Alt/Tiêu đề/Mô tả/Chú thích là thuộc tính của hình ảnh — chỉnh sửa ở đây
        sẽ cập nhật cho TẤT CẢ các sản phẩm sử dụng cùng một hình ảnh (thông qua
        thư viện).
        {images.length > 1 && (
          <>
            {" "}
            <strong className="text-white/80">
              Kéo để sắp xếp lại — vị trí số 1 = Ảnh chính.
            </strong>
          </>
        )}
      </p>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={img.mediaFileId + i}
              className={cn(
                "space-y-1 transition-opacity",
                draggingIndex === i && "opacity-40",
              )}
              draggable
              onDragStart={(e) => {
                setDraggingIndex(i);
                e.dataTransfer.effectAllowed = "move";

                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (hoverIndex !== i) setHoverIndex(i);
              }}
              onDragLeave={() => {
                if (hoverIndex === i) setHoverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingIndex !== null && draggingIndex !== i) {
                  reorderImages(draggingIndex, i);
                }
                setDraggingIndex(null);
                setHoverIndex(null);
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setHoverIndex(null);
              }}
            >
              <button
                type="button"
                onClick={() => setEditingIndex(i)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 group w-full cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-primary",
                  img.isMain ? "border-primary" : "border-transparent",
                  hoverIndex === i &&
                    draggingIndex !== null &&
                    draggingIndex !== i
                    ? "ring-2 ring-cyan-400"
                    : "",
                )}
                title="Nhấp chuột để chỉnh sửa thuộc tính — kéo để sắp xếp lại thứ tự. Vị trí 1 = Chính."
              >
                <Image
                  src={img.card}
                  alt={img.alt ?? `Image ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="200px"
                />

                {img.isMain && (
                  <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                    Main
                  </span>
                )}
                {img.caption && (
                  <span
                    className="absolute bottom-1 left-1 right-1 bg-amber-500/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium truncate"
                    title={img.caption}
                  >
                    ⚠ {img.caption}
                  </span>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="flex items-center gap-1 text-white text-xs font-medium">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </span>
                </div>

                <div className="absolute top-1 right-1 flex gap-1">
                  {!img.isMain && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsMain(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          setAsMain(i);
                        }
                      }}
                      className="h-6 w-6 inline-flex items-center justify-center rounded bg-secondary/80 hover:bg-secondary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Đặt làm ảnh chính"
                    >
                      <Star className="h-3 w-3" />
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        removeImage(i);
                      }
                    }}
                    className="h-6 w-6 inline-flex items-center justify-center rounded bg-destructive/80 hover:bg-destructive text-destructive-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Xóa"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </div>
              </button>

              <p className="text-[10px] text-center truncate text-muted-foreground">
                {img.alt ? (
                  img.alt.slice(0, 30)
                ) : (
                  <span className="text-amber-500/70">alt</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <GalleryPicker
        open={showGallery}
        onOpenChange={setShowGallery}
        onSelect={selectFromGallery}
        onSelectMany={selectManyFromGallery}
        title="Chọn từ thư viện ảnh"
      />

      <Dialog
        open={editingIndex !== null}
        onOpenChange={(open) => !open && setEditingIndex(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {editingIndex !== null && images[editingIndex] && (
            <>
              <DialogHeader>
                <DialogTitle>Thuộc tính ảnh</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-4">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                  <Image
                    src={images[editingIndex].card}
                    alt={images[editingIndex].alt ?? "Preview"}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Thuộc tính này là của <strong>hình ảnh</strong>. Thay đổi
                    tại đây sẽ cập nhật cho TẤT CẢ sản phẩm sử dụng cùng hình
                    ảnh này (thông qua thư viện). Lưu tự động sau khi rời khỏi
                    trường.
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Alt (SEO, khả năng tiếp cận)
                    </Label>
                    <Input
                      type="text"
                      value={images[editingIndex].alt ?? ""}
                      onChange={(e) => {
                        const updated = [...images];
                        updated[editingIndex] = {
                          ...updated[editingIndex],
                          alt: e.target.value,
                        };
                        onChange(updated);
                      }}
                      onFocus={(e) =>
                        handleMetaFocus(editingIndex, "alt", e.target.value)
                      }
                      onBlur={(e) =>
                        handleMetaBlur(editingIndex, "alt", e.target.value)
                      }
                      maxLength={125}
                      placeholder="Mô tả ngắn về ảnh"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tiêu đề (hover)</Label>
                    <Input
                      type="text"
                      value={images[editingIndex].title ?? ""}
                      onChange={(e) => {
                        const updated = [...images];
                        updated[editingIndex] = {
                          ...updated[editingIndex],
                          title: e.target.value,
                        };
                        onChange(updated);
                      }}
                      onFocus={(e) =>
                        handleMetaFocus(editingIndex, "title", e.target.value)
                      }
                      onBlur={(e) =>
                        handleMetaBlur(editingIndex, "title", e.target.value)
                      }
                      maxLength={70}
                      placeholder="Tiêu đề xuất hiện khi hover"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mô tả (SEO)</Label>
                    <Textarea
                      value={images[editingIndex].description ?? ""}
                      onChange={(e) => {
                        const updated = [...images];
                        updated[editingIndex] = {
                          ...updated[editingIndex],
                          description: e.target.value,
                        };
                        onChange(updated);
                      }}
                      onFocus={(e) =>
                        handleMetaFocus(
                          editingIndex,
                          "description",
                          e.target.value,
                        )
                      }
                      onBlur={(e) =>
                        handleMetaBlur(
                          editingIndex,
                          "description",
                          e.target.value,
                        )
                      }
                      rows={2}
                      maxLength={200}
                      placeholder="Mô tả dài cho công cụ tìm kiếm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-amber-500">
                      ⚠ Chú thích lớp phủ (overlay trong bộ sưu tập công khai)
                    </Label>

                    {images[editingIndex].captionPresetId && (
                      <div className="flex items-center gap-2 rounded-md border border-cyan/40 bg-cyan/5 px-2 py-1.5 text-[11px]">
                        <span className="text-cyan font-medium shrink-0">
                          🔗 Đã liên kết:
                        </span>
                        <code className="text-cyan/90 truncate flex-1">
                          {images[editingIndex].captionPresetName ?? "preset"}
                        </code>
                        <button
                          type="button"
                          onClick={() => unlinkPreset(editingIndex)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline whitespace-nowrap shrink-0"
                          title="Bỏ liên kết — cho phép nhập chú thích thủ công"
                        >
                          Bỏ liên kết
                        </button>
                      </div>
                    )}
                    <div className="relative">
                      <Input
                        type="text"
                        value={images[editingIndex].caption ?? ""}
                        onChange={(e) => {
                          const updated = [...images];
                          updated[editingIndex] = {
                            ...updated[editingIndex],
                            caption: e.target.value,
                          };
                          onChange(updated);
                        }}
                        onFocus={(e) =>
                          handleMetaFocus(
                            editingIndex,
                            "caption",
                            e.target.value,
                          )
                        }
                        onBlur={(e) =>
                          handleMetaBlur(
                            editingIndex,
                            "caption",
                            e.target.value,
                          )
                        }
                        readOnly={!!images[editingIndex].captionPresetId}
                        disabled={!!images[editingIndex].captionPresetId}
                        maxLength={200}
                        placeholder={
                          images[editingIndex].captionPresetId
                            ? "Văn bản từ preset — bỏ liên kết để chỉnh sửa"
                            : "Ví dụ: Hình ảnh minh họa — mô hình không được bán"
                        }
                        className={
                          images[editingIndex].captionPresetId
                            ? "border-cyan/30 opacity-70 cursor-not-allowed pr-10"
                            : "border-amber-500/50 pr-10"
                        }
                        title={
                          images[editingIndex].captionPresetId
                            ? "Chỉnh sửa tại /admin/settings sẽ cập nhật cho tất cả các hình ảnh được liên kết"
                            : undefined
                        }
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <CaptionPresetButton
                          onPick={(preset) =>
                            applyPresetTo(editingIndex, preset)
                          }
                        />
                      </div>
                    </div>
                    {images[editingIndex].captionPresetId && (
                      <p className="text-[10px] text-muted-foreground">
                        Chỉnh sửa preset trong{" "}
                        <strong>Cấu hình → Preset chú thích</strong> để cập nhật
                        cho tất cả hình ảnh liên kết cùng lúc.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="button" onClick={() => setEditingIndex(null)}>
                      OK
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
