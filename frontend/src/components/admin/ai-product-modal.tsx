"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { X, Sparkles, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import {
  useAiProductStore,
  type AiPreUploadedMedia,
} from "@/store/ai-product-store";
import type { Brand } from "@/types/product";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AiProductModal({ open, onClose }: Props) {
  const router = useRouter();
  const setAiData = useAiProductStore((s) => s.setData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [collectionValueId, setCollectionValueId] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: brands } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return (data.data ?? data) as Brand[];
    },
  });

  const { data: collections } = useQuery({
    queryKey: ["admin", "attribute", "colecao"],
    queryFn: async () => {
      try {
        const { data } = await api.get("/attributes");
        const attrs = Array.isArray(data) ? data : (data.data ?? []);
        const colecao = attrs.find(
          (a: { slug: string }) => a.slug === "colecao",
        );
        return colecao?.values ?? [];
      } catch {
        return [];
      }
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 2);
    if (files.length) setImages(files);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).slice(0, 2);
      if (files.length) setImages(files);
    },
    [],
  );

  async function handleGenerate() {
    if (!images.length || !name || !brandId) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      images.forEach((img) => formData.append("images", img));
      formData.append("name", name);
      formData.append("brandId", brandId);
      if (collectionValueId)
        formData.append("collectionValueId", collectionValueId);
      if (hint) formData.append("hint", hint);

      const { data } = await api.post("/products/ai-generate", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      const result = data.data;

      if (!result || typeof result.title !== "string" || !result.title.trim()) {
        throw new Error(
          "AI không trả về dữ liệu hợp lệ (phản hồi không đúng định dạng). Vui lòng thử lại.",
        );
      }

      const preUploadedMedia: AiPreUploadedMedia[] = [];
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const uploadForm = new FormData();
        uploadForm.append("file", file);
        const { data: uploadRes } = await api.post(
          "/media/upload",
          uploadForm,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        const media = uploadRes.data ?? uploadRes;
        const alt = result.altText?.[i];
        const title = result.imageTitles?.[i];
        const description = result.imageDescriptions?.[i];

        const metaPatch: {
          alt?: string;
          title?: string;
          description?: string;
        } = {};
        if (typeof alt === "string" && alt) metaPatch.alt = alt;
        if (typeof title === "string" && title) metaPatch.title = title;
        if (typeof description === "string" && description) {
          metaPatch.description = description;
        }
        if (Object.keys(metaPatch).length > 0) {
          await api.put(`/media/${media.id}`, metaPatch);
        }

        preUploadedMedia.push({
          mediaFileId: media.id,
          thumb: media.thumb,
          card: media.card,
          gallery: media.gallery,
          full: media.full,
          alt: metaPatch.alt,
          title: metaPatch.title,
          description: metaPatch.description,
        });
      }

      const aiDataFull = {
        ...result,
        preUploadedMedia,
      };
      setAiData(aiDataFull);

      try {
        sessionStorage.setItem("ai_product_data", JSON.stringify(aiDataFull));
      } catch {}

      onClose();
      router.push("/admin/products/new");
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      setError(resp?.error?.message ?? resp?.message ?? "Lỗi khi tạo với AI");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-purple/25 bg-ink-soft p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-white/40 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="h-5 w-5 text-purple" />
          <h2 className="text-lg font-bold [font-family:var(--font-orbitron)]">
            Tạo sản phẩm với AI
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-1 block">Hình ảnh (1-2)</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-purple/30 bg-white/[0.02] p-6 cursor-pointer hover:border-cyan/50 transition-colors"
            >
              {images.length > 0 ? (
                <div className="flex gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={URL.createObjectURL(img)}
                        alt={`Preview ${i + 1}`}
                        className="h-24 w-24 rounded-lg object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-white/40">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Kéo thả hình ảnh hoặc nhấp để chọn</p>
                  <p className="text-xs">JPG, PNG hoặc WebP (tối đa 2)</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div>
            <Label className="text-xs">Tên sản phẩm</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: songoku ssj2"
            />
          </div>

          <div>
            <Label className="text-xs">Nhãn hiệu</Label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan/70"
            >
              <option value="">Chọn nhãn hiệu</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {collections && collections.length > 0 && (
            <div>
              <Label className="text-xs">Bộ sưu tập (tùy chọn)</Label>
              <select
                value={collectionValueId}
                onChange={(e) => setCollectionValueId(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan/70"
              >
                <option value="">Không có bộ sưu tập</option>
                {collections.map((c: { id: string; value: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="text-xs">Gợi ý cho AI (tùy chọn)</Label>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ví dụ: songoku ssj2 chiến đấu với vegeta"
              rows={2}
              className="flex w-full rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan/70 resize-y"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            onClick={handleGenerate}
            disabled={loading || !images.length || !name || !brandId}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo với AI...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Tạo với AI
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
