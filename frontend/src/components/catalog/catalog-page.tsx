"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { ProductCard } from "@/components/product/product-card";
import {
  Breadcrumb,
  type BreadcrumbItem,
} from "@/components/layout/breadcrumb";
import { api } from "@/lib/api-client";
import { trackViewItemList } from "@/lib/ga4-events";
import { useCatalogFilterStore } from "@/store/catalog-filter-store";
import type { Product } from "@/types/product";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogSidebar } from "./catalog-sidebar";
import { CatalogFilters, type CatalogFiltersData } from "./catalog-filters";
import { CatalogAppliedChips } from "./catalog-applied-chips";
import { CatalogPagination } from "./catalog-pagination";
import { CatalogLoadMore } from "./catalog-load-more";
import { CatalogMobileFilterSheet } from "./catalog-mobile-filter-sheet";

interface CatalogPageProps {
  title: string;
  description?: string;

  breadcrumb?: BreadcrumbItem[];
  categoryId?: string;
  brandId?: string;
  tagId?: string;
  search?: string;

  listId: string;
  listName: string;
}

const PER_PAGE = 24;

interface ApiMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}

interface ProductsResponse {
  data: Product[];
  meta: ApiMeta;
  filters: CatalogFiltersData | null;
}

export function CatalogPage({
  title,
  description,
  breadcrumb,
  categoryId,
  brandId,
  tagId,
  search,
  listId,
  listName,
}: CatalogPageProps) {
  const [filtersData, setFiltersData] = useState<CatalogFiltersData | null>(
    null,
  );

  const { filters, setFilter, clearAll, activeChips, hasActiveFilters } =
    useCatalogFilters({
      fixedBrandId: brandId,
      fixedCategoryId: categoryId,
      fixedTagId: tagId,
      brandsForLabels: filtersData?.brands,
      attributesForLabels: filtersData?.attributes,
    });

  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({
    total: 0,
    page: 1,
    perPage: PER_PAGE,
    lastPage: 1,
  });
  const [loading, setLoading] = useState(true);
  // const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFiltersOpen = useCatalogFilterStore((s) => s.mobileFiltersOpen);
  const setMobileFiltersOpen = useCatalogFilterStore(
    (s) => s.setMobileFiltersOpen,
  );
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (mobileFiltersOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {
      page: String(filters.page),
      perPage: String(PER_PAGE),
    };
    if (categoryId) params.categoryId = categoryId;
    if (filters.brandId) params.brandId = filters.brandId;
    if (tagId) params.tagId = tagId;
    if (search) params.search = search;
    if (filters.attributes.length) {
      params.attributes = filters.attributes.join(",");
    }
    if (filters.priceMin !== undefined) {
      params.priceMin = String(filters.priceMin);
    }
    if (filters.priceMax !== undefined) {
      params.priceMax = String(filters.priceMax);
    }
    if (filters.featured) params.featured = "true";
    if (filters.onSale) params.onSale = "true";
    if (filters.sort !== "alphabetical") params.sort = filters.sort;

    api
      .get<ProductsResponse>("/products", { params })
      .then(({ data }) => {
        if (cancelled) return;
        const newProducts = data.data ?? [];

        if (!isDesktop && filters.page > 1) {
          setProducts((prev) => [...prev, ...newProducts]);
        } else {
          setProducts(newProducts);
        }
        setMeta(
          data.meta ?? {
            total: 0,
            page: filters.page,
            perPage: PER_PAGE,
            lastPage: 1,
          },
        );
        setFiltersData(data.filters ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, categoryId, tagId, search, isDesktop]);

  const lastFiredKey = useRef<string | null>(null);
  useEffect(() => {
    if (loading || products.length === 0) return;
    const key = `${listId}:${filters.page}`;
    if (lastFiredKey.current === key) return;
    lastFiredKey.current = key;
    trackViewItemList(products, { listId, listName });
  }, [loading, products, listId, listName, filters.page]);

  const hideBrandFilter = !!brandId;
  const showSkeleton = loading && products.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8">
        {breadcrumb && breadcrumb.length > 0 && (
          <Breadcrumb items={breadcrumb} />
        )}
        <h1 className="text-[26px] font-black leading-[1.05] tracking-tight text-white sm:text-3xl md:text-4xl xl:text-5xl">
          {title}
        </h1>
        {!showSkeleton && (
          <p className="mt-3 text-[13px] [font-family:var(--font-mono)] text-white/45">
            <span className="font-bold text-white">{meta.total}</span> sản phẩm
          </p>
        )}
        {description && (
          <p className="mt-3 max-w-2xl text-sm text-white/60">{description}</p>
        )}
      </header>

      <CatalogToolbar
        sort={filters.sort}
        onSortChange={(v) => setFilter("sort", v)}
        onMobileFiltersClick={() => setMobileFiltersOpen(true)}
        activeFilterCount={activeChips.length}
      />

      <CatalogMobileFilterSheet
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        filters={filters}
        data={filtersData}
        onFilterChange={setFilter}
        hideBrandFilter={hideBrandFilter}
        totalCount={meta.total}
      />

      <div className="flex gap-8">
        <CatalogSidebar>
          <CatalogFilters
            filters={filters}
            data={filtersData}
            onFilterChange={setFilter}
            hideBrandFilter={hideBrandFilter}
          />
        </CatalogSidebar>

        <div className="flex-1 min-w-0">
          <CatalogAppliedChips chips={activeChips} onClearAll={clearAll} />

          {showSkeleton ? (
            <CatalogSkeleton count={PER_PAGE} withSidebar={false} />
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-white/50">
                Không có sản phẩm nào với bộ lọc này.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-3 text-xs text-cyan hover:underline"
                >
                  Xóa bộ lọc và thử lại
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              <div className="hidden lg:block">
                <CatalogPagination
                  currentPage={filters.page}
                  totalPages={meta.lastPage}
                  onPageChange={(p) => {
                    setFilter("page", p);
                    if (typeof window !== "undefined") {
                      window.scrollTo(0, 0);
                    }
                  }}
                />
              </div>

              <div className="lg:hidden">
                <CatalogLoadMore
                  hasMore={filters.page < meta.lastPage}
                  loading={loading}
                  remaining={Math.max(0, meta.total - products.length)}
                  onClick={() => setFilter("page", filters.page + 1)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
