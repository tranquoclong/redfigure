"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import {
  Upload,
  Trash2,
  Pencil,
  Loader2,
  Search,
  X,
  ZoomIn,
  Check,
  Copy,
  Link2,
} from "lucide-react";
import { formatDate } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/pagination";
import { api } from "@/lib/api-client";
import { CaptionPresetButton } from "@/components/admin/caption-preset-popover";
import { OrphanScanDialog } from "@/components/admin/orphan-scan-dialog";
import {
  bulkDeleteMedia,
  type BulkDeleteFailure,
} from "@/lib/bulk-delete-media";

import { extractError } from "@/lib/extract-error";
interface MediaFile {
  id: string;
  filename: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  original: string | null;
  alt: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export default function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCaption, setEditCaption] = useState("");

  const [editCaptionPresetId, setEditCaptionPresetId] = useState<string | null>(
    null,
  );
  const [editCaptionPresetName, setEditCaptionPresetName] = useState<
    string | null
  >(null);

  const [zoomMedia, setZoomMedia] = useState<MediaFile | null>(null);

  const [detailMedia, setDetailMedia] = useState<MediaFile | null>(null);
  const [copiedVariant, setCopiedVariant] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    deleted: number;
    failures: BulkDeleteFailure[];
  } | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const bulkDeletingRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "gallery", page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 24 };
      if (search) params.search = search;
      const { data } = await api.get("/media", { params });
      return data.data ? data : data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "gallery"] });
      setError("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...dto
    }: {
      id: string;
      alt?: string;
      title?: string;
      description?: string;
      caption?: string;
      captionPresetId?: string | null;
    }) => api.put(`/media/${id}`, dto),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["admin", "gallery"] });
      setEditingId(null);
      setError("");
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setUploadError("");

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await api.post("/media/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (err) {
        const msg = extractError(err);
        setUploadError(`không thành công "${file.name}": ${msg}`);
      }
    }

    await queryClient.refetchQueries({ queryKey: ["admin", "gallery"] });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startEditing(media: MediaFile) {
    setEditingId(media.id);
    setEditAlt(media.alt ?? "");
    setEditTitle(media.title ?? "");
    setEditDesc(media.description ?? "");
    setEditCaption(media.caption ?? "");
    const mm = media as {
      captionPresetId?: string | null;
      captionPreset?: { id: string; name: string; text: string } | null;
    };
    setEditCaptionPresetId(mm.captionPreset?.id ?? mm.captionPresetId ?? null);
    setEditCaptionPresetName(mm.captionPreset?.name ?? null);
  }

  function handleSaveMeta() {
    if (!editingId) return;

    updateMutation.mutate({
      id: editingId,
      alt: editAlt,
      title: editTitle,
      description: editDesc,
      caption: editCaption,

      captionPresetId: editCaptionPresetId,
    });
  }

  function handleDelete(media: MediaFile) {
    if (confirm(`Chắc chắn muốn xóa "${media.filename}"?`)) {
      deleteMutation.mutate(media.id);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage(pageIds: string[]) {
    setSelectedIds((prev) => {
      const allOnPageSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (bulkDeletingRef.current) return;
    bulkDeletingRef.current = true;
    setShowBulkConfirm(false);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      bulkDeletingRef.current = false;
      return;
    }
    setBulkDeleting(true);
    setError("");
    setBulkResult(null);
    try {
      const result = await bulkDeleteMedia(ids, {
        delete: (url) => api.delete(url),
      });

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of result.succeeded) next.delete(id);
        return next;
      });
      setBulkResult({
        deleted: result.succeeded.length,
        failures: result.failed,
      });
      await queryClient.refetchQueries({ queryKey: ["admin", "gallery"] });
    } finally {
      setBulkDeleting(false);
      bulkDeletingRef.current = false;
    }
  }

  const items = (data?.data ?? []) as MediaFile[];
  const meta = data?.meta ?? { total: 0, page: 1, perPage: 24, lastPage: 1 };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold"> thư viện ảnh</h1>
          <p className="text-sm text-muted-foreground mt-1">{meta.total} ảnh</p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Đang tải lên..." : "Tải lên"}
          </Button>
          <OrphanScanDialog />
        </div>
      </div>

      {uploadError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {uploadError}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {bulkResult && (
        <div
          className={`border rounded-md px-4 py-3 mb-4 text-sm ${
            bulkResult.failures.length === 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {bulkResult.deleted > 0 && (
                <p>{bulkResult.deleted} ảnh đã được xóa.</p>
              )}
              {bulkResult.failures.length > 0 && (
                <div className="mt-1">
                  <p>{bulkResult.failures.length} đã thất bại:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs">
                    {bulkResult.failures.slice(0, 5).map((f) => (
                      <li key={f.id}>
                        <code>{f.id.slice(0, 8)}…</code>: {f.message}
                      </li>
                    ))}
                    {bulkResult.failures.length > 5 && (
                      <li>
                        … và {bulkResult.failures.length - 5} lỗi khác — xem
                        Console (F12) để biết chi tiết.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBulkResult(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput);
          setPage(1);
        }}
        className="flex gap-2 mb-6 max-w-md"
      >
        <Input
          placeholder="Tìm kiếm theo tên hoặc alt..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2 border rounded-md bg-muted/30">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={
                  items.length > 0 && items.every((m) => selectedIds.has(m.id))
                }
                ref={(el) => {
                  if (el) {
                    const someSelected = items.some((m) =>
                      selectedIds.has(m.id),
                    );
                    const allSelected = items.every((m) =>
                      selectedIds.has(m.id),
                    );
                    el.indeterminate = someSelected && !allSelected;
                  }
                }}
                onChange={() => toggleSelectAllOnPage(items.map((m) => m.id))}
                aria-label="Chọn tất cả trong trang"
              />
              <span>Chọn tất cả trong trang</span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} được chọn
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  disabled={bulkDeleting}
                >
                  Xóa lựa chọn
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowBulkConfirm(true)}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Xóa ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Không tìm thấy ảnh nào.</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {items.map((media) => (
            <div key={media.id}>
              <div className="flex items-center gap-4 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer flex-shrink-0"
                  checked={selectedIds.has(media.id)}
                  onChange={() => toggleSelection(media.id)}
                  aria-label={`Chọn ${media.filename}`}
                />

                <div className="relative w-[60px] h-[60px] flex-shrink-0 rounded-md overflow-hidden bg-muted">
                  <Image
                    src={media.thumb}
                    alt={media.alt ?? media.filename}
                    fill
                    className="object-cover"
                    sizes="60px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {media.filename}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {media.alt ? (
                      media.alt
                    ) : (
                      <span className="text-destructive">Không có ALT</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {media.width && media.height
                      ? `${media.width} x ${media.height}px`
                      : "Kích thước không xác định"}
                    {" \u00B7 "}
                    {formatDate(media.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoomMedia(media)}
                  >
                    <ZoomIn className="h-4 w-4 mr-1" />
                    Phóng to
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailMedia(media);
                      startEditing(media);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Chỉnh sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(media)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Xóa
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} lastPage={meta.lastPage} onPageChange={setPage} />

      <Dialog
        open={!!detailMedia}
        onOpenChange={(open) => {
          if (!open) {
            setDetailMedia(null);
            setEditingId(null);
            setCopiedVariant(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {detailMedia?.filename}
            </DialogTitle>
          </DialogHeader>
          {detailMedia && (
            <div className="space-y-6">
              <div className="flex justify-center bg-[#06010f] rounded-lg p-4 border border-[#00f0ff]/10">
                <img
                  src={detailMedia.card}
                  alt={detailMedia.alt ?? detailMedia.filename}
                  className="max-h-[200px] object-contain rounded"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {detailMedia.width && detailMedia.height
                  ? `${detailMedia.width} x ${detailMedia.height}px`
                  : "Không xác định kích thước"}
                {" · "}
                {formatDate(detailMedia.createdAt)}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-[#00f0ff]">
                    <Link2 className="h-4 w-4" />
                    Các liên kết khác
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#ff007a]/30 text-[#ff007a] hover:bg-[#ff007a]/10 hover:text-[#ff007a]"
                    onClick={() => {
                      const variants = [
                        {
                          label: "Thumb",
                          size: "200px",
                          url: detailMedia.thumb,
                        },
                        { label: "Card", size: "600px", url: detailMedia.card },
                        {
                          label: "Gallery",
                          size: "1000px",
                          url: detailMedia.gallery,
                        },
                        {
                          label: "Full",
                          size: "1920px",
                          url: detailMedia.full,
                        },
                        {
                          label: "Original",
                          size: "max",
                          url: detailMedia.original,
                        },
                      ].filter((v) => v.url);

                      const seoLines = [
                        `Tên gốc: ${detailMedia.filename}`,
                        `Tiêu đề: ${detailMedia.title ?? ""}`,
                        `Alt: ${detailMedia.alt ?? ""}`,
                        `Mô tả: ${detailMedia.description ?? ""}`,
                      ];
                      const variantLines = variants.map(
                        (v) => `${v.label} (${v.size}): ${v.url}`,
                      );

                      const text = [...seoLines, "", ...variantLines].join(
                        "\n",
                      );

                      navigator.clipboard.writeText(text);
                      setCopiedVariant("all");
                      setTimeout(() => setCopiedVariant(null), 2000);
                    }}
                  >
                    {copiedVariant === "all" ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-[#00f0ff]" /> Đã
                        copy!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="space-y-2">
                  {(
                    [
                      { label: "Thumb", size: "200px", url: detailMedia.thumb },
                      { label: "Card", size: "600px", url: detailMedia.card },
                      {
                        label: "Gallery",
                        size: "1000px",
                        url: detailMedia.gallery,
                      },
                      { label: "Full", size: "1920px", url: detailMedia.full },
                      {
                        label: "Original",
                        size: "max",
                        url: detailMedia.original,
                      },
                    ] as Array<{
                      label: string;
                      size: string;
                      url: string | null;
                    }>
                  )
                    .filter((v) => v.url)
                    .map((variant) => (
                      <div
                        key={variant.label}
                        className="rounded-lg border border-[#00f0ff]/20 bg-[#0f0421] p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#00f0ff]">
                              {variant.label}
                            </span>
                            <span className="text-[10px] text-[#00f0ff]/50 bg-[#00f0ff]/10 px-1.5 py-0.5 rounded">
                              {variant.size}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-7 px-2 text-xs hover:bg-[#00f0ff]/10 hover:text-[#00f0ff]"
                            onClick={() => {
                              navigator.clipboard.writeText(variant.url!);
                              setCopiedVariant(variant.label);
                              setTimeout(() => setCopiedVariant(null), 2000);
                            }}
                          >
                            {copiedVariant === variant.label ? (
                              <>
                                <Check className="h-3 w-3 mr-1 text-[#00f0ff]" />{" "}
                                Đã copy
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <code className="text-[11px] text-muted-foreground break-all block font-mono leading-relaxed select-all">
                          {variant.url}
                        </code>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">SEO</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Alt (khả năng tiếp cận + SEO)
                    </Label>
                    <Input
                      value={editAlt}
                      onChange={(e) => setEditAlt(e.target.value)}
                      placeholder="Mô tả hình ảnh"
                      maxLength={125}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tiêu đề (hover)</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Tiêu đề hình ảnh"
                      maxLength={70}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Mô tả (SEO)</Label>
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      placeholder="Mô tả dài cho bộ máy tìm kiếm"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-amber-500 flex items-center gap-1">
                      ⚠ Chú thích chồng lên nhau trong thư viện ảnh (overlay
                      công khai)
                    </Label>
                    {editCaptionPresetId && (
                      <div className="flex items-center gap-2 rounded-md border border-cyan/40 bg-cyan/5 px-2 py-1.5 text-[11px] mb-1">
                        <span className="text-cyan font-medium">
                          🔗 Liên kết với preset:
                        </span>
                        <code className="text-cyan/90 truncate flex-1">
                          {editCaptionPresetName ?? "preset"}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCaptionPresetId(null);
                            setEditCaptionPresetName(null);
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 underline whitespace-nowrap"
                          title="Tách liên kết để chỉnh sửa thủ công"
                        >
                          Tách liên kết
                        </button>
                      </div>
                    )}
                    <div className="relative">
                      <Input
                        value={editCaption}
                        onChange={(e) => {
                          setEditCaption(e.target.value);

                          setEditCaptionPresetId(null);
                          setEditCaptionPresetName(null);
                        }}
                        readOnly={!!editCaptionPresetId}
                        disabled={!!editCaptionPresetId}
                        placeholder="Ví dụ: Hình ảnh minh họa — bản thu nhỏ không được bán kèm sơn"
                        maxLength={200}
                        className={
                          editCaptionPresetId
                            ? "border-cyan/30 opacity-60 cursor-not-allowed pr-10"
                            : "border-amber-500/50 pr-10"
                        }
                        title={
                          editCaptionPresetId
                            ? "Văn bản đến từ preset — chỉnh sửa tại /admin/settings để cập nhật tất cả các hình ảnh được liên kết"
                            : undefined
                        }
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CaptionPresetButton
                          onPick={(preset) => {
                            setEditCaption(preset.text);
                            setEditCaptionPresetId(preset.id);
                            setEditCaptionPresetName(preset.name);
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Thuộc tính hình ảnh — ảnh hưởng đến TẤT CẢ các sản phẩm và
                      biểu ngữ sử dụng phương tiện này.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleSaveMeta}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!zoomMedia}
        onOpenChange={(open) => !open && setZoomMedia(null)}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{zoomMedia?.filename}</DialogTitle>
          </DialogHeader>
          {zoomMedia && (
            <div className="flex items-center justify-center overflow-auto">
              <img
                src={zoomMedia.full}
                alt={zoomMedia.alt ?? zoomMedia.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Xóa {selectedIds.size} hình ảnh?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Thao tác này không thể hoàn tác. Mỗi tệp sẽ xóa 4 biến thể
            (thumb/card/gallery/full) khỏi bộ nhớ và bản ghi khỏi banco.
          </p>

          {(() => {
            const visibleSelectedCount = items.filter((m) =>
              selectedIds.has(m.id),
            ).length;
            const offPageCount = selectedIds.size - visibleSelectedCount;
            return offPageCount > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md px-3 py-2 text-xs">
                <strong>Cảnh báo:</strong> {offPageCount} hình ảnh được chọn
                KHÔNG hiển thị trên trang này (lựa chọn vẫn được duy trì giữa
                các trang). Tổng: {selectedIds.size}.
              </div>
            ) : null;
          })()}
          {selectedIds.size <= 10 && (
            <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto border rounded px-3 py-2 bg-muted/20">
              {items
                .filter((m) => selectedIds.has(m.id))
                .map((m) => (
                  <li key={m.id} className="truncate">
                    • {m.filename}
                  </li>
                ))}
            </ul>
          )}
          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="ghost"
              onClick={() => setShowBulkConfirm(false)}
              disabled={bulkDeleting}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Xóa {selectedIds.size}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
