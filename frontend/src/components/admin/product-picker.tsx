"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Search, X, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ProductSearchItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isDraft: boolean;
  images?: Array<{ mediaFile?: { thumb?: string | null } | null }>;

  imageUrl?: string | null;
  thumb?: string | null;
}

interface ProductPickerProps {
  value: string | null;
  onChange: (productId: string | null) => void;
  helperText?: string;
  disabled?: boolean;
}

function pickThumb(p: ProductSearchItem): string | null {
  if (p.thumb) return p.thumb;
  if (p.imageUrl) return p.imageUrl;
  const main = p.images?.[0]?.mediaFile?.thumb;
  return main ?? null;
}

export function ProductPicker({
  value,
  onChange,
  helperText,
  disabled = false,
}: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const selectedQuery = useQuery({
    queryKey: ["admin", "product-picker", "selected", value],
    queryFn: async () => {
      if (!value) return null;
      const { data } = await api.get(`/products/${value}`);
      return data.data as ProductSearchItem;
    },
    enabled: !!value,
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["admin", "product-picker", "list", debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { perPage: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get("/products/admin", { params });
      return (data.data ?? []) as ProductSearchItem[];
    },
    enabled: open,
  });

  function handleSelect(item: ProductSearchItem) {
    onChange(item.id);
    setOpen(false);
    setSearch("");
  }

  function handleClear() {
    onChange(null);
  }

  const selected = selectedQuery.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          {value ? "Thay đổi sản phẩm" : "Chọn sản phẩm"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={handleClear}
          >
            <X className="h-4 w-4 mr-2" />
            Xóa sản phẩm
          </Button>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-3 max-w-md">
          {selectedQuery.isLoading ? (
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          ) : selected ? (
            <>
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                {pickThumb(selected) ? (
                  <Image
                    src={pickThumb(selected) as string}
                    alt={selected.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                ) : (
                  <Package className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {selected.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  /{selected.slug}
                </div>
                {(selected.isDraft || !selected.isActive) && (
                  <div className="mt-1 inline-flex rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">
                    {selected.isDraft ? "Nháp" : "Không hoạt động"} — dùng
                    fallback
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              Không tìm thấy sản phẩm (ID {value}). Lưu mà không chọn để dùng
              fallback.
            </div>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Tìm kiếm theo tên hoặc SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border/60">
              {listQuery.isLoading && (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
                </div>
              )}
              {!listQuery.isLoading && listQuery.data?.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  Không tìm thấy sản phẩm.
                </div>
              )}
              {listQuery.data?.map((p) => {
                const thumb = pickThumb(p);
                const isSelected = p.id === value;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/40 p-3 text-left transition-colors hover:bg-accent/50",
                      isSelected && "bg-accent/50",
                    )}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <Package className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        /{p.slug}
                      </div>
                    </div>
                    {(p.isDraft || !p.isActive) && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">
                        {p.isDraft ? "Nháp" : "Không hoạt động"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
