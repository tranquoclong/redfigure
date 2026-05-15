"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Star,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { revalidateFeaturedCategories } from "../_actions";
import { BlocksEditor } from "./blocks/blocks-editor";

import { extractError } from "@/lib/extract-error";
interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface FeaturedCategory {
  id: string;
  categoryId: string;
  category: Category;
  displayLabel: string | null;
  glowColor: string;
  order: number;
  isActive: boolean;
}

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
}

const PRESET_COLORS = [
  { hex: "#ff007a", name: "Magenta" },
  { hex: "#00f0ff", name: "Cyan" },
  { hex: "#b829ff", name: "Purple" },
  { hex: "#ffd166", name: "Yellow" },
  { hex: "#ff66c4", name: "Pink" },
  { hex: "#8a2bff", name: "Deep purple" },
];

export default function HomeAdminPage() {
  const queryClient = useQueryClient();

  const featuredQuery = useQuery({
    queryKey: ["admin", "featured-categories"],
    queryFn: async () => {
      const { data } = await api.get<{ data: FeaturedCategory[] }>(
        "/admin/featured-categories",
      );
      return data.data;
    },
  });

  const allCategoriesQuery = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: async () => {
      const { data } = await api.get<{ data: Category[] }>("/categories");
      return (data.data ?? []).filter((c) => c.isActive);
    },
  });

  const featuredProductsQuery = useQuery({
    queryKey: ["admin", "featured-products"],
    queryFn: async () => {
      const { data } = await api.get<{ data: FeaturedProduct[] }>("/products", {
        params: { featured: true, perPage: 50 },
      });
      return data.data ?? [];
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [glowColor, setGlowColor] = useState("#ff007a");
  const [displayLabel, setDisplayLabel] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/featured-categories", {
        categoryId: selectedCategoryId,
        glowColor,
        displayLabel: displayLabel.trim() || undefined,
      });
      await revalidateFeaturedCategories();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "featured-categories"],
      });
      setDialogOpen(false);
      setSelectedCategoryId("");
      setGlowColor("#ff007a");
      setDisplayLabel("");
      setError("");
    },
    onError: (err) => setError(extractError(err)),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/featured-categories/${id}`);
      await revalidateFeaturedCategories();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "featured-categories"],
      });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (params: { id: string; direction: "up" | "down" }) => {
      const list = featuredQuery.data ?? [];
      const idx = list.findIndex((f) => f.id === params.id);
      if (idx === -1) return;
      const swapWith =
        params.direction === "up" ? list[idx - 1] : list[idx + 1];
      if (!swapWith) return;
      const newItems = list.map((f, i) => {
        if (i === idx) return { id: f.id, order: swapWith.order };
        if (f.id === swapWith.id)
          return { id: swapWith.id, order: list[idx].order };
        return { id: f.id, order: f.order };
      });
      await api.put("/admin/featured-categories/reorder", { items: newItems });
      await revalidateFeaturedCategories();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "featured-categories"],
      });
    },
  });

  const featuredIds = new Set(
    (featuredQuery.data ?? []).map((f) => f.categoryId),
  );
  const availableCategories = (allCategoriesQuery.data ?? []).filter(
    (c) => !featuredIds.has(c.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Home</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cấu hình các phần của trang chủ: danh mục nổi bật (MUA THEO PHONG
          CÁCH) và sản phẩm nổi bật (MUA NHIỀU NHẤT).
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Danh mục nổi bật</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Xuất hiện trong lưới &quot;MUA THEO PHONG CÁCH&quot; ở trang chủ.
              Thứ tự tại đây là thứ tự hiển thị.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={availableCategories.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm danh mục
          </Button>
        </CardHeader>
        <CardContent>
          {featuredQuery.isLoading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
            </div>
          ) : featuredQuery.data && featuredQuery.data.length > 0 ? (
            <div className="space-y-2">
              {featuredQuery.data.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div
                    className="h-10 w-10 shrink-0 rounded-lg"
                    style={{
                      background: `radial-gradient(circle at 50% 30%, ${item.glowColor}, transparent 70%), #0c0322`,
                      boxShadow: `0 0 18px ${item.glowColor}55`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {(item.displayLabel ?? item.category.name).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Danh mục: {item.category.name} ({item.category.slug})
                    </p>
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-1 rounded bg-muted"
                    style={{ color: item.glowColor }}
                  >
                    {item.glowColor}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        moveMutation.mutate({ id: item.id, direction: "up" })
                      }
                      disabled={idx === 0 || moveMutation.isPending}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        moveMutation.mutate({ id: item.id, direction: "down" })
                      }
                      disabled={
                        idx === (featuredQuery.data?.length ?? 0) - 1 ||
                        moveMutation.isPending
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            `Remover ${item.category.name} dos destaques da home?`,
                          )
                        ) {
                          removeMutation.mutate(item.id);
                        }
                      }}
                      disabled={removeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Chưa có danh mục nổi bật nào. Hãy thêm danh mục đầu tiên!
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Sản phẩm được yêu thích nhất (sản phẩm nổi bật)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Hiển thị trong mục &quot;SẢN PHẨM ĐƯỢC YÊU THÍCH NHẤT&quot; ở trang
            chủ. Để thêm hoặc xóa sản phẩm, hãy đánh dấu hoặc bỏ đánh dấu vào ô
            &quot;Nổi bật trên trang chủ&quot; trong biểu mẫu sản phẩm. Thứ tự
            hiển thị theo thời gian cập nhật gần nhất.
          </p>
        </CardHeader>
        <CardContent>
          {featuredProductsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
            </div>
          ) : featuredProductsQuery.data &&
            featuredProductsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {featuredProductsQuery.data.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/products/${p.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-cyan/40"
                >
                  <Star className="h-4 w-4 text-cyan shrink-0" />
                  <p className="flex-1 text-sm">{p.name}</p>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Chưa có sản phẩm nào được đánh dấu là nổi bật. Hãy vào sản phẩm và
              đánh dấu &quot;Nổi bật trên trang chủ&quot;.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="border-t border-border pt-2" />

      <BlocksEditor />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm danh mục nổi bật</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Danh mục</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={(v) => setSelectedCategoryId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Nhãn trang chủ (tùy chọn)</Label>
              <Input
                placeholder="Để trống để sử dụng tên danh mục"
                value={displayLabel}
                onChange={(e) => setDisplayLabel(e.target.value)}
                maxLength={50}
              />
            </div>

            <div>
              <Label className="text-xs">Màu sắc</Label>
              <div className="grid grid-cols-6 gap-2 mt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setGlowColor(c.hex)}
                    title={c.name}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      glowColor === c.hex
                        ? "border-white scale-110"
                        : "border-transparent"
                    }`}
                    style={{
                      background: `radial-gradient(circle at 50% 30%, ${c.hex}, transparent 70%), #0c0322`,
                      boxShadow:
                        glowColor === c.hex ? `0 0 18px ${c.hex}` : undefined,
                    }}
                  />
                ))}
              </div>
              <Input
                value={glowColor}
                onChange={(e) => setGlowColor(e.target.value)}
                className="mt-2 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !selectedCategoryId}
            >
              {createMutation.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
