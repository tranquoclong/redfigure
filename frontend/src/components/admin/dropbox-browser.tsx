"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Folder,
  Image as ImageIcon,
  ChevronRight,
  Home,
  Star,
  Sparkles,
  Upload,
  Loader2,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import {
  useAiProductStore,
  type AiProductData,
} from "@/store/ai-product-store";
import type { Brand } from "@/types/product";

interface DropboxEntry {
  name: string;
  path: string;
}

interface SelectedImage {
  name: string;
  path: string;
  previewUrl?: string;
  isFeatured: boolean;
}

export function DropboxBrowser() {
  const router = useRouter();
  const setAiData = useAiProductStore((s) => s.setData);

  const queryClient = useQueryClient();
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const fetchedPreviewsRef = useRef<Set<string>>(new Set());
  const [brandId, setBrandId] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [hint, setHint] = useState("");

  const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const { data: aiPresets } = useQuery({
    queryKey: ["admin", "ai-instruction-presets"],
    queryFn: async () => {
      const { data } = await api.get("/settings/ai-instruction-presets");
      return (data.data ?? []) as Array<{ name: string; text: string }>;
    },
    retry: false,
  });

  useEffect(() => {
    const initialPath = sessionStorage.getItem("dropbox_initial_path");
    if (initialPath !== null) {
      sessionStorage.removeItem("dropbox_initial_path");
      setCurrentPath(initialPath);
      return;
    }
    api
      .get("/dropbox/root-path")
      .then(({ data }) => {
        setCurrentPath(data.data?.rootPath || "");
      })
      .catch(() => {
        setCurrentPath("");
      });
  }, []);

  const { data: brands } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return (data.data ?? data) as Brand[];
    },
  });

  const {
    data: folder,
    isLoading,
    error: browseError,
  } = useQuery({
    queryKey: ["dropbox", "browse", currentPath],
    queryFn: async () => {
      const { data } = await api.get(
        `/dropbox/browse?path=${encodeURIComponent(currentPath ?? "")}`,
      );
      return data.data as {
        path: string;
        folders: DropboxEntry[];
        images: DropboxEntry[];
      };
    },
    enabled: currentPath !== null,
    retry: false,
  });

  const breadcrumbs = currentPath
    ? currentPath
        .split("/")
        .filter(Boolean)
        .map((part, i, arr) => ({
          name: part,
          path: "/" + arr.slice(0, i + 1).join("/"),
        }))
    : [];

  function navigateTo(path: string) {
    setCurrentPath(path);
    setFilter("");
    setPreviews({});
  }

  function handleRefresh() {
    setPreviews({});
    queryClient.invalidateQueries({
      queryKey: ["dropbox", "browse", currentPath],
    });
  }

  useEffect(() => {
    if (!folder?.images.length) return;
    let cancelled = false;

    const pending = folder.images
      .filter((img) => !fetchedPreviewsRef.current.has(img.path))
      .map((img) => img.path);

    if (pending.length === 0) return;
    pending.forEach((p) => fetchedPreviewsRef.current.add(p));

    api
      .post("/dropbox/thumbnails", { paths: pending })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data.data as Array<{
          path: string;
          thumbnail: string | null;
        }>;
        setPreviews((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (row.thumbnail) next[row.path] = row.thumbnail;
          }
          return next;
        });
      })
      .catch(() => {
        pending.forEach((p) => fetchedPreviewsRef.current.delete(p));
      });

    return () => {
      cancelled = true;
    };
  }, [folder?.images]);

  const filterLower = filter.toLowerCase();
  const filteredFolders = folder?.folders
    .filter((f) => !filter || f.name.toLowerCase().includes(filterLower))
    .sort((a, b) => a.name.localeCompare(b.name, "vi-VN"));
  const filteredImages = folder?.images
    .filter((img) => !filter || img.name.toLowerCase().includes(filterLower))
    .sort((a, b) => a.name.localeCompare(b.name, "vi-VN"));

  function toggleImage(img: DropboxEntry) {
    setSelectedImages((prev) => {
      const existing = prev.find((s) => s.path === img.path);
      if (existing) {
        return prev.filter((s) => s.path !== img.path);
      }
      return [...prev, { ...img, isFeatured: prev.length === 0 }];
    });
  }

  function setFeatured(path: string) {
    setSelectedImages((prev) =>
      prev.map((img) => ({ ...img, isFeatured: img.path === path })),
    );
  }

  function isSelected(path: string) {
    return selectedImages.some((s) => s.path === path);
  }

  useEffect(() => {
    for (const img of selectedImages) {
      if (img.previewUrl) continue;
      api
        .get(`/dropbox/preview?path=${encodeURIComponent(img.path)}`)
        .then(({ data }) => {
          setSelectedImages((prev) =>
            prev.map((s) =>
              s.path === img.path ? { ...s, previewUrl: data.data.link } : s,
            ),
          );
        })
        .catch(() => {});
    }
  }, [selectedImages]);

  async function handleAnalyzeWithAI() {
    if (!selectedImages.length || !brandId || !originalName.trim()) {
      setError("Hãy chọn hình ảnh, thương hiệu và tên.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const sorted = [...selectedImages].sort((a, b) =>
        a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1,
      );

      interface DownloadedMedia {
        id: string;
        filename: string;
        thumb: string;
        card: string;
        gallery: string;
        full: string;
        alt?: string;
        title?: string;
        description?: string;
      }
      let mediaFiles: DownloadedMedia[];
      try {
        const { data: downloadResult } = await api.post(
          "/dropbox/download",
          {
            paths: sorted.map((img) => img.path),
          },
          { timeout: 120000 },
        );
        mediaFiles = downloadResult.data;
      } catch (dlErr) {
        const resp = (
          dlErr as { response?: { data?: { error?: { message?: string } } } }
        )?.response?.data;
        const isTimeout = (dlErr as { code?: string })?.code === "ECONNABORTED";
        throw new Error(
          isTimeout
            ? "Việc tải xuống hình ảnh mất quá nhiều thời gian. Hãy thử sử dụng ít hình ảnh hơn hoặc thử lại."
            : (resp?.error?.message ??
                "Không thể tải xuống hình ảnh từ Dropbox. Vui lòng kiểm tra thông tin xác thực trong Cài đặt."),
        );
      }

      const aiMediaIds = mediaFiles.slice(0, 2).map((mf) => mf.id);

      let aiData: AiProductData;
      try {
        const formData = new FormData();
        formData.append("name", originalName);
        formData.append("brandId", brandId);
        formData.append("mediaFileIds", JSON.stringify(aiMediaIds));
        if (hint) formData.append("hint", hint);

        const { data: aiResult } = await api.post(
          "/products/ai-generate",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120000,
          },
        );
        aiData = aiResult.data;
      } catch (aiErr) {
        const resp = (
          aiErr as { response?: { data?: { error?: { message?: string } } } }
        )?.response?.data;
        throw new Error(
          resp?.error?.message ??
            "Không thể phân tích với AI. Vui lòng kiểm tra khóa API trong Cài đặt.",
        );
      }

      if (!aiData || typeof aiData.title !== "string" || !aiData.title.trim()) {
        throw new Error(
          "AI không trả về dữ liệu hợp lệ (phản hồi không đúng định dạng). Hãy thử lại hoặc đăng ký thủ công — bạn có thể xóa hình ảnh trùng lặp trong /admin/gallery nếu muốn thử lại.",
        );
      }

      for (let i = 0; i < aiMediaIds.length; i++) {
        const mfId = aiMediaIds[i];
        const metaPatch: {
          alt?: string;
          title?: string;
          description?: string;
        } = {};
        const alt = aiData.altText?.[i];
        const title = aiData.imageTitles?.[i];
        const description = aiData.imageDescriptions?.[i];
        if (typeof alt === "string" && alt) metaPatch.alt = alt;
        if (typeof title === "string" && title) metaPatch.title = title;
        if (typeof description === "string" && description) {
          metaPatch.description = description;
        }
        if (Object.keys(metaPatch).length > 0) {
          try {
            await api.put(`/media/${mfId}`, metaPatch);
          } catch {}
        }
      }

      const aiDataWithBrand: AiProductData = { ...aiData, brandId };
      setAiData(aiDataWithBrand);

      try {
        sessionStorage.setItem(
          "ai_product_data",
          JSON.stringify(aiDataWithBrand),
        );
      } catch {}

      sessionStorage.setItem(
        "dropbox_media_files",
        JSON.stringify(
          mediaFiles.map((mf, i) => ({
            mediaFileId: mf.id,
            thumb: mf.thumb,
            card: mf.card,
            gallery: mf.gallery,
            full: mf.full,
            alt: aiData.altText?.[i] ?? "",
            title: aiData.imageTitles?.[i] ?? "",
            description: aiData.imageDescriptions?.[i] ?? "",
            isMain: sorted[i]?.isFeatured ?? i === 0,
            order: i,
          })),
        ),
      );

      const targetPath = renameTargetPath ?? currentPath;
      if (targetPath) {
        sessionStorage.setItem("dropbox_folder_path", targetPath);
        const parentPath =
          targetPath.substring(0, targetPath.lastIndexOf("/")) || "";
        sessionStorage.setItem("dropbox_parent_path", parentPath);
      }

      router.push("/admin/products/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xử lý hình ảnh");
    } finally {
      setProcessing(false);
    }
  }

  async function handleUseWithoutAI() {
    if (!selectedImages.length) {
      setError("Chọn ít nhất 1 hình ảnh.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const { data: downloadResult } = await api.post("/dropbox/download", {
        paths: selectedImages.map((img) => img.path),
      });
      const mediaFiles = downloadResult.data;

      sessionStorage.setItem(
        "dropbox_media_files",
        JSON.stringify(
          mediaFiles.map(
            (
              mf: {
                id: string;
                thumb: string;
                card: string;
                gallery: string;
                full: string;
              },
              i: number,
            ) => ({
              mediaFileId: mf.id,
              thumb: mf.thumb,
              card: mf.card,
              gallery: mf.gallery,
              full: mf.full,
              isMain: selectedImages[i]?.isFeatured ?? i === 0,
              order: i,
            }),
          ),
        ),
      );

      const targetPath = renameTargetPath ?? currentPath;
      if (targetPath) {
        sessionStorage.setItem("dropbox_folder_path", targetPath);
        const parentPath =
          targetPath.substring(0, targetPath.lastIndexOf("/")) || "";
        sessionStorage.setItem("dropbox_parent_path", parentPath);
      }

      router.push("/admin/products/new");
    } catch (err) {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "Lỗi khi tải hình ảnh");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button
          className="hover:text-primary flex items-center gap-1"
          onClick={() => navigateTo("")}
        >
          <Home className="h-4 w-4" />
          Root
        </button>
        {breadcrumbs.map((bc) => (
          <span key={bc.path} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              className="hover:text-primary hover:underline"
              onClick={() => navigateTo(bc.path)}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Lọc trên màn hình..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Cập nhật thư mục"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {browseError ? (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {(() => {
                const resp = (
                  browseError as {
                    response?: {
                      data?: { error?: { message?: string }; message?: string };
                    };
                  }
                )?.response?.data;
                return (
                  resp?.error?.message ??
                  resp?.message ??
                  "Không thể kết nối với Dropbox. Vui lòng kiểm tra mã thông báo trong Cài đặt."
                );
              })()}
            </div>
          ) : isLoading || currentPath === null ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải...
            </p>
          ) : (
            <>
              {filteredFolders?.length ? (
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                    Thư mục
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {filteredFolders.map((f) => (
                      <button
                        key={f.path}
                        className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent text-left transition-colors"
                        onClick={() => navigateTo(f.path)}
                      >
                        <Folder className="h-5 w-5 text-yellow-500 shrink-0" />
                        <span className="text-sm truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {filteredImages?.length ? (
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                    Hình ảnh
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {filteredImages.map((img) => (
                      <button
                        key={img.path}
                        className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                          isSelected(img.path)
                            ? "border-cyan ring-2 ring-cyan/30"
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        onClick={() => toggleImage(img)}
                      >
                        {previews[img.path] ? (
                          <Image
                            src={previews[img.path]}
                            alt={img.name}
                            fill
                            className="object-cover"
                            sizes="150px"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                          </div>
                        )}
                        {isSelected(img.path) && (
                          <div className="absolute top-1 right-1 bg-cyan rounded-full p-0.5">
                            <Check className="h-3 w-3 text-black" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                          <p className="text-[10px] text-white truncate">
                            {img.name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!filteredFolders?.length && !filteredImages?.length && (
                <p className="text-muted-foreground text-sm">
                  {filter ? "Không có kết quả cho bộ lọc" : "Thư mục trống"}
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Chọn ({selectedImages.length} hình ảnh)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-3 py-2 text-xs">
                  {error}
                </div>
              )}

              {selectedImages.length > 0 && (
                <div className="space-y-2">
                  {(() => {
                    const aiOrder = [...selectedImages].sort((a, b) =>
                      a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1,
                    );
                    const aiPaths = new Set(
                      aiOrder.slice(0, 2).map((i) => i.path),
                    );

                    return selectedImages.map((img) => (
                      <div
                        key={img.path}
                        className="flex items-center gap-2 p-2 rounded border text-sm"
                      >
                        {img.previewUrl ? (
                          <Image
                            src={img.previewUrl}
                            alt={img.name}
                            width={40}
                            height={40}
                            className="rounded object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="truncate block text-xs">
                            {img.name}
                          </span>
                          {aiPaths.has(img.path) && (
                            <span className="text-[10px] text-purple font-medium">
                              AI
                            </span>
                          )}
                        </div>
                        <button
                          className={`p-1 rounded ${img.isFeatured ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`}
                          onClick={() => setFeatured(img.path)}
                          title="Đánh dấu là chính"
                        >
                          <Star
                            className="h-4 w-4"
                            fill={img.isFeatured ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                    ));
                  })()}
                  {selectedImages.length > 2 && (
                    <p className="text-[10px] text-muted-foreground">
                      Chỉ 2 hình ảnh được chọn cho AI (ưu tiên hình ảnh chính).
                      Tất cả sẽ được hiển thị trong thư viện.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Thương hiệu</Label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                  >
                    <option value="">Chọn</option>
                    {brands?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tên gốc</Label>
                  <Input
                    value={originalName}
                    onChange={(e) => setOriginalName(e.target.value)}
                    placeholder="Ex: ironman"
                    className="h-9"
                  />
                </div>

                {currentPath && breadcrumbs.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Thư mục cần đổi tên</Label>
                    <select
                      value={renameTargetPath ?? currentPath}
                      onChange={(e) => setRenameTargetPath(e.target.value)}
                      className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                    >
                      <option value={currentPath}>
                        {breadcrumbs[breadcrumbs.length - 1].name} (hiện tại)
                      </option>

                      {breadcrumbs
                        .slice(0, -1)
                        .reverse()
                        .map((bc) => (
                          <option key={bc.path} value={bc.path}>
                            {bc.name}
                          </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      Đổi tên thư mục thành SKU của sản phẩm sau khi đăng ký.
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Preset hướng dẫn</Label>
                  {aiPresets && aiPresets.length > 0 ? (
                    <select
                      value=""
                      onChange={(e) => {
                        const preset = aiPresets.find(
                          (p) => p.name === e.target.value,
                        );
                        if (preset) {
                          setHint((prev) =>
                            prev.trim()
                              ? `${prev.trim()}\n${preset.text}`
                              : preset.text,
                          );
                        }
                        e.target.value = "";
                      }}
                      className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Chọn preset</option>
                      {aiPresets.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Không có preset.{" "}
                      <a
                        href="/admin/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Quản lý cài đặt
                      </a>
                      .
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Hướng dẫn thêm (AI)</Label>
                  <textarea
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Ví dụ: có đế đi kèm, tỷ lệ 75mm"
                    className="flex w-full rounded-md border bg-background px-3 py-2 text-sm resize-y min-h-[60px]"
                    rows={2}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  disabled={
                    processing ||
                    !selectedImages.length ||
                    !brandId ||
                    !originalName.trim()
                  }
                  onClick={handleAnalyzeWithAI}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Phân tích với AI
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={processing || !selectedImages.length}
                  onClick={handleUseWithoutAI}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Sử dụng mà không cần AI
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
