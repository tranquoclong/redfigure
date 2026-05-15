"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { ImagePicker } from "@/components/admin/image-picker";
import { revalidateBanners } from "../_actions";

import { extractError } from "@/lib/extract-error";
interface Banner {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  primaryCtaLabel: string | null;
  primaryCtaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

interface BannerForm {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  imageUrl: string;
  order: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

const emptyForm: BannerForm = {
  eyebrow: "",
  title: "",
  subtitle: "",
  primaryCtaLabel: "",
  primaryCtaHref: "",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
  imageUrl: "",
  order: "0",
  isActive: true,
  startDate: "",
  endDate: "",
};

function bannerToForm(b: Banner): BannerForm {
  return {
    eyebrow: b.eyebrow ?? "",
    title: b.title,
    subtitle: b.subtitle ?? "",
    primaryCtaLabel: b.primaryCtaLabel ?? "",
    primaryCtaHref: b.primaryCtaHref ?? "",
    secondaryCtaLabel: b.secondaryCtaLabel ?? "",
    secondaryCtaHref: b.secondaryCtaHref ?? "",
    imageUrl: b.imageUrl ?? "",
    order: String(b.order),
    isActive: b.isActive,
    startDate: b.startDate ? b.startDate.slice(0, 16) : "",
    endDate: b.endDate ? b.endDate.slice(0, 16) : "",
  };
}

function formToPayload(f: BannerForm) {
  return {
    eyebrow: f.eyebrow.trim() || undefined,
    title: f.title.trim(),
    subtitle: f.subtitle.trim() || undefined,
    primaryCtaLabel: f.primaryCtaLabel.trim() || undefined,
    primaryCtaHref: f.primaryCtaHref.trim() || undefined,
    secondaryCtaLabel: f.secondaryCtaLabel.trim() || undefined,
    secondaryCtaHref: f.secondaryCtaHref.trim() || undefined,
    imageUrl: f.imageUrl.trim() || undefined,
    order: Number(f.order) || 0,
    isActive: f.isActive,
    startDate: f.startDate ? new Date(f.startDate).toISOString() : undefined,
    endDate: f.endDate ? new Date(f.endDate).toISOString() : undefined,
  };
}

export default function BannersPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [error, setError] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async () => {
      const { data } = await api.get<{ data: Banner[] }>("/admin/banners");
      return data.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = formToPayload(form);
      if (editingId) {
        await api.put(`/admin/banners/${editingId}`, payload);
      } else {
        await api.post("/admin/banners", payload);
      }
      await revalidateBanners();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/banners/${id}`);
      await revalidateBanners();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(banner: Banner) {
    setEditingId(banner.id);
    setForm(bannerToForm(banner));
    setError("");
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Banners Hero</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chỉnh sửa các banner được hiển thị trên cùng của trang chủ. Bạn có
            thể lên lịch các chiến dịch với ngày bắt đầu/kết thúc tùy chọn.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Thêm banner
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
            </div>
          ) : listQuery.data && listQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Hình ảnh</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead className="w-20 text-center">Thứ tự</TableHead>
                  <TableHead className="w-24 text-center">Hoạt động</TableHead>
                  <TableHead className="w-32">Thời gian</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.map((banner) => (
                  <TableRow key={banner.id}>
                    <TableCell>
                      {banner.imageUrl ? (
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="h-12 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded bg-muted grid place-items-center text-[10px] text-muted-foreground">
                          Không có ảnh
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{banner.title}</p>
                      {banner.eyebrow && (
                        <p className="text-xs text-muted-foreground">
                          {banner.eyebrow}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {banner.order}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          banner.isActive
                            ? "inline-block h-2 w-2 rounded-full bg-green-500"
                            : "inline-block h-2 w-2 rounded-full bg-muted-foreground/40"
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {banner.startDate || banner.endDate
                        ? `${banner.startDate?.slice(0, 10) ?? "∞"} → ${banner.endDate?.slice(0, 10) ?? "∞"}`
                        : "Luôn luôn"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(banner)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (
                              confirm(
                                `Xóa banner "${banner.title}"? Không thể hoàn tác.`,
                              )
                            ) {
                              removeMutation.mutate(banner.id);
                            }
                          }}
                          disabled={removeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Chưa có banner nào. Hãy tạo banner đầu tiên!
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Sửa banner" : "Thêm banner"}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ảnh</CardTitle>
              </CardHeader>
              <CardContent>
                <ImagePicker
                  value={form.imageUrl === "" ? null : form.imageUrl}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, imageUrl: url ?? "" }))
                  }
                  variant="full"
                  aspectRatio="auto"
                  helperText="Khuyến nghị: 1920×1080 hoặc lớn hơn. Quá trình tải lên tự động tạo ra 4 kích thước WebP khác nhau."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Nội dung</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">
                    Eyebrow (text nhỏ phía trên tiêu đề)
                  </Label>
                  <Input
                    placeholder="★ Bộ sưu tập Neon Vol. 2"
                    value={form.eyebrow}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, eyebrow: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Tiêu đề *</Label>
                  <Input
                    placeholder="Mô hình"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Tiêu đề phụ</Label>
                  <textarea
                    placeholder="Mô hình"
                    value={form.subtitle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, subtitle: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Nút bấm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nút bấm chính</Label>
                    <Input
                      placeholder="EXPLORAR CATÁLOGO"
                      value={form.primaryCtaLabel}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          primaryCtaLabel: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Link nút bấm chính</Label>
                    <Input
                      placeholder="/products"
                      value={form.primaryCtaHref}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          primaryCtaHref: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nút bấm phụ</Label>
                    <Input
                      placeholder="Khám phá"
                      value={form.secondaryCtaLabel}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          secondaryCtaLabel: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Link nút bấm phụ</Label>
                    <Input
                      placeholder="/products?order=releases"
                      value={form.secondaryCtaHref}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          secondaryCtaHref: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Lên lịch (tùy chọn)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ngày bắt đầu</Label>
                    <Input
                      type="datetime-local"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ngày kết thúc</Label>
                    <Input
                      type="datetime-local"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Bỏ trống để hiển thị luôn.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Thứ tự</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.order}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, order: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, isActive: e.target.checked }))
                        }
                        className="h-4 w-4 cursor-pointer accent-purple"
                      />
                      <span className="text-sm">Kích hoạt</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.title.trim()}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lưu…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Lưu
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
