"use client";

import { useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CatalogFilters as CatalogFiltersState } from "@/hooks/use-catalog-filters";

const FILTER_SEARCH_THRESHOLD = 8;

interface FilterBrand {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface FilterAttributeValue {
  id: string;
  value: string;
  slug: string;
  count: number;
}

interface FilterAttribute {
  id: string;
  name: string;
  slug: string;
  values: FilterAttributeValue[];
}

export interface CatalogFiltersData {
  brands: FilterBrand[];
  attributes: FilterAttribute[];
  priceRange: { min: number; max: number };
}

interface CatalogFiltersProps {
  filters: CatalogFiltersState;
  data: CatalogFiltersData | null;
  onFilterChange: <K extends keyof CatalogFiltersState>(
    key: K,
    value: CatalogFiltersState[K],
  ) => void;
  hideBrandFilter?: boolean;
}

interface FilterSectionProps<T> {
  title: string;
  options: T[];
  searchableText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

function FilterLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-white/85">
      <span className="text-cyan">{"// "}</span>
      {children}
    </h3>
  );
}

function FilterSection<T extends { id: string }>({
  title,
  options,
  searchableText,
  renderItem,
}: FilterSectionProps<T>) {
  const [search, setSearch] = useState("");
  const showSearch = options.length > FILTER_SEARCH_THRESHOLD;
  const term = search.trim().toLowerCase();
  const filtered =
    showSearch && term
      ? options.filter((o) => searchableText(o).toLowerCase().includes(term))
      : options;

  return (
    <div>
      <FilterLabel>{title}</FilterLabel>
      {showSearch && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <Input
            type="text"
            placeholder={`Tìm kiếm ${title.toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg border-white/10 bg-black/30 pl-8 pr-8 text-xs text-white placeholder:text-white/30 focus-visible:border-cyan/70"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/50 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div
        className={
          showSearch
            ? "max-h-[220px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]"
            : "space-y-1.5"
        }
      >
        {filtered.length === 0 ? (
          <p className="py-2 text-xs text-white/40">Không tìm thấy kết quả</p>
        ) : (
          filtered.map(renderItem)
        )}
      </div>
    </div>
  );
}

export function CatalogFilters({
  filters,
  data,
  onFilterChange,
  hideBrandFilter = false,
}: CatalogFiltersProps) {
  const handleAttributeToggle = (valueId: string) => {
    const current = filters.attributes;
    const next = current.includes(valueId)
      ? current.filter((id) => id !== valueId)
      : [...current, valueId];
    onFilterChange("attributes", next);
  };

  return (
    <div data-testid="catalog-filters" className="divide-y divide-white/5">
      <div className="space-y-3 pb-5">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/85 transition-colors hover:text-white">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(e) => onFilterChange("onSale", e.target.checked)}
            className="h-4 w-4 accent-magenta"
          />
          <span>Chỉ giảm giá</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/85 transition-colors hover:text-white">
          <input
            type="checkbox"
            checked={filters.featured}
            onChange={(e) => onFilterChange("featured", e.target.checked)}
            className="h-4 w-4 accent-cyan"
          />
          <span>Chỉ nổi bật</span>
        </label>
      </div>

      {data && data.priceRange.max > 0 && (
        <div className="py-5">
          <FilterLabel>Giá</FilterLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Min"
              value={filters.priceMin ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onFilterChange("priceMin", v ? Number(v) : undefined);
              }}
              className="h-10 rounded-lg border-white/10 bg-black/30 text-[13px] [font-family:var(--font-mono)] text-white placeholder:text-white/30 focus-visible:border-cyan/70"
              aria-label="Giá tối thiểu"
            />
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Max"
              value={filters.priceMax ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onFilterChange("priceMax", v ? Number(v) : undefined);
              }}
              className="h-10 rounded-lg border-white/10 bg-black/30 text-[13px] [font-family:var(--font-mono)] text-white placeholder:text-white/30 focus-visible:border-cyan/70"
              aria-label="Giá tối đa"
            />
          </div>
        </div>
      )}

      {!hideBrandFilter && data && data.brands.length > 0 && (
        <div className="py-5">
          <FilterSection
            title="Thương hiệu"
            options={data.brands}
            searchableText={(b) => b.name}
            renderItem={(brand) => (
              <label
                key={brand.id}
                className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/75 transition-colors hover:text-white"
              >
                <input
                  type="radio"
                  name="brand"
                  checked={filters.brandId === brand.id}
                  onChange={() => onFilterChange("brandId", brand.id)}
                  className="h-3.5 w-3.5 accent-purple"
                />
                <span className="flex-1">{brand.name}</span>
                <span className="text-[11px] [font-family:var(--font-mono)] text-white/40">
                  ({brand.count})
                </span>
              </label>
            )}
          />
        </div>
      )}

      {data?.attributes.map((attr) => (
        <div key={attr.id} className="py-5">
          <FilterSection
            title={attr.name}
            options={attr.values}
            searchableText={(v) => v.value}
            renderItem={(val) => (
              <label
                key={val.id}
                className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/75 transition-colors hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={filters.attributes.includes(val.id)}
                  onChange={() => handleAttributeToggle(val.id)}
                  className="h-4 w-4 accent-purple"
                />
                <span className="flex-1">{val.value}</span>
                <span className="text-[11px] [font-family:var(--font-mono)] text-white/40">
                  ({val.count})
                </span>
              </label>
            )}
          />
        </div>
      ))}
    </div>
  );
}
