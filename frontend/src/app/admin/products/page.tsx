"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Sparkles,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  Star,
  X,
} from "lucide-react";
import { AiProductModal } from "@/components/admin/ai-product-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Product, Category, Brand } from "@/types/product";

type SortOption = "recent" | "alphabetical" | "price-asc" | "price-desc";
type TypeFilter = "" | "simple" | "variable" | "bundle";
type StockFilter = "" | "in_stock" | "out_of_stock" | "low_stock";
type FeaturedFilter = "" | "true";

const DEFAULT_SORT: SortOption = "recent";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("");

  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT);

  const hasActiveFilters =
    !!categoryId ||
    !!brandId ||
    !!typeFilter ||
    !!stockFilter ||
    !!featuredFilter ||
    sort !== DEFAULT_SORT ||
    !!debouncedSearch;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function withPageReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const { data: categoriesData } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return (data.data ?? data) as Category[];
    },
  });

  const { data: brandsData } = useQuery({
    queryKey: ["admin", "brands"],
    queryFn: async () => {
      const { data } = await api.get("/brands");
      return (data.data ?? data) as Brand[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin",
      "products",
      page,
      debouncedSearch,
      categoryId,
      brandId,
      typeFilter,
      stockFilter,
      featuredFilter,
      sort,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        perPage: 20,
        sort,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryId) params.categoryId = categoryId;
      if (brandId) params.brandId = brandId;
      if (typeFilter) params.type = typeFilter;
      if (stockFilter) params.stockStatus = stockFilter;
      if (featuredFilter) params.featured = featuredFilter;
      const { data } = await api.get("/products/admin", { params });
      return data;
    },
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      await api.put(`/products/${id}`, { featured });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  function clearFilters() {
    setCategoryId("");
    setBrandId("");
    setTypeFilter("");
    setStockFilter("");
    setFeaturedFilter("");
    setSort(DEFAULT_SORT);
    setSearch("");
  }

  function handleSortName() {
    setSort(sort === "alphabetical" ? DEFAULT_SORT : "alphabetical");
    setPage(1);
  }

  function handleSortPrice() {
    setSort((s) =>
      s === "price-asc"
        ? "price-desc"
        : s === "price-desc"
          ? DEFAULT_SORT
          : "price-asc",
    );
    setPage(1);
  }

  function stockDisplay(product: Product) {
    if (product.type === "bundle")
      return <span className="text-muted-foreground text-xs">Bộ sưu tập</span>;
    if (product.type === "variable") {
      const vars = product.variations ?? [];
      if (vars.length === 0)
        return <span className="text-muted-foreground text-xs">-</span>;
      const managed = vars.filter((v) => v.manageStock !== false);
      if (managed.length === 0)
        return <span className="text-muted-foreground text-xs">-</span>;
      const total = managed.reduce((sum, v) => sum + (v.stock ?? 0), 0);
      if (total <= 0)
        return <span className="text-red-400 font-medium text-xs">0</span>;
      if (total <= 5)
        return (
          <span className="text-amber-400 font-medium text-xs">{total}</span>
        );
      return <span className="text-xs">{total}</span>;
    }
    if (product.manageStock === false)
      return <span className="text-muted-foreground text-xs">-</span>;
    const available = (product.stock ?? 0) - (product.reservedStock ?? 0);
    if (available <= 0)
      return <span className="text-red-400 font-medium text-xs">0</span>;
    if (available <= 5)
      return (
        <span className="text-amber-400 font-medium text-xs">{available}</span>
      );
    return <span className="text-xs">{available}</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Sản phẩm</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[260px]"
            />
          </div>
          <Button variant="outline" onClick={() => setAiModalOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Thêm bằng AI
          </Button>
          <Link href="/admin/products/dropbox">
            <Button variant="outline">
              <FolderOpen className="h-4 w-4 mr-2" />
              Đồng bộ Dropbox
            </Button>
          </Link>
          <Link href="/admin/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Sản phẩm mới
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterSelect
          value={categoryId}
          onChange={withPageReset(setCategoryId)}
          placeholder="Chọn danh mục"
          options={(categoriesData ?? []).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <FilterSelect
          value={typeFilter}
          onChange={withPageReset((v: string) =>
            setTypeFilter(v as TypeFilter),
          )}
          placeholder="Chọn loại sản phẩm"
          options={[
            { value: "simple", label: "Đơn giản" },
            { value: "variable", label: "Phiên bản" },
            { value: "bundle", label: "Bộ sưu tập" },
          ]}
        />
        <FilterSelect
          value={stockFilter}
          onChange={withPageReset((v: string) =>
            setStockFilter(v as StockFilter),
          )}
          placeholder="Chọn tình trạng kho hàng"
          options={[
            { value: "in_stock", label: "Còn hàng" },
            { value: "low_stock", label: "Hết hàng (≤5)" },
            { value: "out_of_stock", label: "Hết hàng" },
          ]}
        />
        <FilterSelect
          value={brandId}
          onChange={withPageReset(setBrandId)}
          placeholder="Chọn thương hiệu"
          options={(brandsData ?? []).map((b) => ({
            value: b.id,
            label: b.name,
          }))}
        />
        <FilterSelect
          value={featuredFilter}
          onChange={withPageReset((v: string) =>
            setFeaturedFilter(v as FeaturedFilter),
          )}
          placeholder="Nổi bật"
          options={[{ value: "true", label: "Nổi bật" }]}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Ảnh</TableHead>
                  <SortableHead
                    active={sort === "alphabetical"}
                    direction="asc"
                    onClick={handleSortName}
                  >
                    Tên
                  </SortableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <SortableHead
                    active={sort === "price-asc" || sort === "price-desc"}
                    direction={sort === "price-desc" ? "desc" : "asc"}
                    onClick={handleSortPrice}
                  >
                    Giá
                  </SortableHead>
                  <TableHead>Tồn kho</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-12 text-center" title="Nổi bật">
                    ★
                  </TableHead>
                  <TableHead>Thương hiệu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.map((product: Product) => {
                  const mainImg = product.images?.[0];
                  const imgUrl = mainImg?.mediaFile?.thumb ?? mainImg?.url;
                  const cats =
                    product.productCategories
                      ?.map((pc) => pc.category?.name)
                      .filter(Boolean) ?? [];
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="block w-10 h-10 rounded overflow-hidden bg-muted/30 border border-white/10"
                        >
                          {imgUrl ? (
                            <Image
                              src={imgUrl}
                              alt={mainImg?.altText ?? product.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-[10px]">
                              —
                            </div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {product.sku ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {cats.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cats.slice(0, 2).map((name, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] font-normal"
                              >
                                {name}
                              </Badge>
                            ))}
                            {cats.length > 2 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{cats.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.type === "variable" &&
                        product.variations?.length
                          ? (() => {
                              const prices = product.variations.map(
                                (v) => v.salePrice ?? v.price,
                              );
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              return min === max
                                ? formatCurrency(min)
                                : `${formatCurrency(min)} – ${formatCurrency(max)}`;
                            })()
                          : formatCurrency(
                              product.salePrice ?? product.basePrice,
                            )}
                      </TableCell>
                      <TableCell>{stockDisplay(product)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 flex-wrap">
                          {product.isDraft ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 text-amber-400"
                            >
                              Bản nháp
                            </Badge>
                          ) : (
                            <Badge
                              variant={
                                product.isActive ? "default" : "secondary"
                              }
                            >
                              {product.isActive
                                ? "Hoạt động"
                                : "Ngừng hoạt động"}
                            </Badge>
                          )}
                          {product.type !== "bundle" &&
                            (() => {
                              if (product.type === "variable") {
                                const vars = product.variations ?? [];
                                const managed = vars.filter(
                                  (v) => v.manageStock !== false,
                                );
                                if (
                                  managed.length > 0 &&
                                  managed.every((v) => (v.stock ?? 0) <= 0)
                                ) {
                                  return (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px]"
                                    >
                                      Hết hàng
                                    </Badge>
                                  );
                                }
                              } else if (
                                product.manageStock !== false &&
                                (product.stock ?? 0) -
                                  (product.reservedStock ?? 0) <=
                                  0
                              ) {
                                return (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px]"
                                  >
                                    Hết hàng
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() =>
                            toggleFeatured.mutate({
                              id: product.id,
                              featured: !product.featured,
                            })
                          }
                          disabled={toggleFeatured.isPending}
                          className="p-1 rounded hover:bg-muted/50 transition-colors"
                          title={
                            product.featured
                              ? "Bỏ đánh dấu nổi bật"
                              : "Đánh dấu nổi bật"
                          }
                        >
                          <Star
                            className={cn(
                              "h-4 w-4 transition-colors",
                              product.featured
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/40",
                            )}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">
                        {product.brand?.name ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {data?.meta && (
            <Pagination
              page={page}
              lastPage={data.meta.lastPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}
      <AiProductModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-md border border-border/60 bg-background px-3 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        value ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="text-foreground">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SortableHead({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 hover:text-primary transition-colors",
          active && "text-primary",
        )}
      >
        {children}
        {active &&
          (direction === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </button>
    </TableHead>
  );
}
