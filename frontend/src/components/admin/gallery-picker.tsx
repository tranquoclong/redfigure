"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export interface GalleryMedia {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt: string | null;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

interface GalleryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  onSelect?: (media: GalleryMedia) => void;

  onSelectMany?: (medias: GalleryMedia[]) => void;
  title?: string;

  keepOpenOnInclude?: boolean;
}

export function GalleryPicker({
  open,
  onOpenChange,
  onSelect,
  onSelectMany,
  title = "Chọn ảnh từ thư viện",
  keepOpenOnInclude = false,
}: GalleryPickerProps) {
  const multiMode = !!onSelectMany;
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["gallery-picker", search],
    queryFn: async () => {
      const params: Record<string, string | number> = { perPage: 60 };
      if (search) params.search = search;
      const { data } = await api.get("/media", { params });
      return (data.data ?? []) as GalleryMedia[];
    },
    enabled: open,
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedIds([]);
      setPreviewId(null);
      setSearch("");
    }
    onOpenChange(next);
  }

  function toggle(media: GalleryMedia) {
    if (multiMode) {
      setSelectedIds((prev) => {
        const idx = prev.indexOf(media.id);
        if (idx >= 0) {
          return prev.filter((id) => id !== media.id);
        }

        return [...prev, media.id];
      });
      setPreviewId(media.id);
    } else {
      setSelectedIds([media.id]);
      setPreviewId(media.id);
    }
  }

  function handleInclude() {
    const items = data ?? [];

    const byId = new Map(items.map((m) => [m.id, m]));
    const selected = selectedIds
      .map((id) => byId.get(id))
      .filter((m): m is GalleryMedia => !!m);
    if (selected.length === 0) return;

    if (multiMode && onSelectMany) {
      onSelectMany(selected);
      handleOpenChange(false);
    } else if (onSelect) {
      onSelect(selected[0]);
      if (keepOpenOnInclude) {
        setSelectedIds([]);
        setPreviewId(null);
      } else {
        handleOpenChange(false);
      }
    }
  }

  function handleSelectAll() {
    const items = data ?? [];
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((m) => m.id));
    }
  }

  const items = data ?? [];
  const preview = items.find((m) => m.id === previewId) ?? null;
  const count = selectedIds.length;
  const selectedIdSet = new Set(selectedIds);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw]! sm:max-w-[95vw]! w-[95vw] h-[90vh] max-h-[90vh] flex! flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {title}
            {multiMode && count > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({count} ảnh đã chọn)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Tìm kiếm theo tên hoặc alt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          {multiMode && items.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedIds.length === items.length
                ? "Xóa lựa chọn"
                : "Chọn tất cả"}
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 auto-rows-min gap-3 overflow-y-auto pr-1 flex-1 content-start">
            {items.map((media) => {
              const isSelected = selectedIdSet.has(media.id);
              const selectionOrder = isSelected
                ? selectedIds.indexOf(media.id) + 1
                : 0;
              return (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => toggle(media)}
                  className={`relative aspect-square rounded border overflow-hidden transition-all ${
                    isSelected
                      ? "ring-2 ring-primary border-primary"
                      : "hover:ring-2 hover:ring-primary/50"
                  }`}
                >
                  <Image
                    src={media.card || media.thumb}
                    alt={media.alt ?? media.filename}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw"
                  />
                  {isSelected && (
                    <span className="absolute top-1 right-1 rounded-full bg-primary text-primary-foreground h-6 w-6 flex items-center justify-center text-[11px] font-bold shadow">
                      {selectionOrder}
                    </span>
                  )}
                  {media.caption && (
                    <span
                      className="absolute bottom-1 left-1 right-1 bg-amber-500/90 text-white text-[9px] px-1 py-0.5 rounded truncate"
                      title={media.caption}
                    >
                      ⚠ {media.caption}
                    </span>
                  )}
                </button>
              );
            })}
            {items.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                Không tìm thấy ảnh.
              </p>
            )}
          </div>

          <div className="lg:w-[360px] xl:w-[420px] shrink-0 border border-border rounded-lg p-4 bg-card flex flex-col gap-3 overflow-y-auto">
            {preview ? (
              <>
                <div className="relative aspect-square w-full rounded overflow-hidden border border-border bg-background">
                  <Image
                    src={preview.gallery || preview.full || preview.card}
                    alt={preview.alt ?? preview.filename}
                    fill
                    className="object-contain"
                    sizes="420px"
                  />
                </div>

                <dl className="text-sm space-y-2 text-foreground">
                  <Row label="Tên file" value={preview.filename} mono />
                  <Row label="Alt" value={preview.alt ?? "—"} />
                  <Row label="Tiêu đề" value={preview.title ?? "—"} />
                  <Row label="Mô tả" value={preview.description ?? "—"} />
                  <Row label="Chú thích" value={preview.caption ?? "—"} />
                  <Row
                    label="Kích thước"
                    value={
                      preview.width && preview.height
                        ? `${preview.width} × ${preview.height} px`
                        : "—"
                    }
                  />
                </dl>

                <div className="mt-auto flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedIds([]);
                      setPreviewId(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Xóa lựa chọn
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={handleInclude}
                    disabled={count === 0}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {multiMode ? "Thêm ảnh" : "Chọn"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/70 text-center my-auto">
                {multiMode
                  ? "Chọn ảnh để thêm (có thể chọn nhiều ảnh)."
                  : "Chọn một ảnh bên cạnh để xem chi tiết và chọn."}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-foreground/60 shrink-0 w-24 font-medium">{label}:</dt>
      <dd
        className={`flex-1 break-words text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
