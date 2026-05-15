"use client";

import { Filter } from "lucide-react";
import type { CatalogSortOption } from "@/hooks/use-catalog-filters";

interface CatalogToolbarProps {
  sort: CatalogSortOption;
  onSortChange: (sort: CatalogSortOption) => void;

  onMobileFiltersClick?: () => void;
  activeFilterCount?: number;
}

const SORT_LABELS: Record<CatalogSortOption, string> = {
  alphabetical: "Theo bảng chữ cái",
  recent: "Mới nhất",
  sold: "Bán chạy nhất",
  "price-asc": "Giá thấp nhất",
  "price-desc": "Giá cao nhất",
};

const SORT_ORDER: CatalogSortOption[] = [
  "alphabetical",
  "recent",
  "sold",
  "price-asc",
  "price-desc",
];

const SELECT_CHEVRON =
  "appearance-none bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20fill%3D%22none%22%20stroke%3D%22%23ffffff66%22%20stroke-width%3D%221.5%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px_6px] bg-[position:right_12px_center] bg-no-repeat";

export function CatalogToolbar({
  sort,
  onSortChange,
  onMobileFiltersClick,
  activeFilterCount = 0,
}: CatalogToolbarProps) {
  return (
    <div
      data-testid="catalog-toolbar"
      className="mb-6 flex items-stretch gap-2.5 lg:items-center"
    >
      {onMobileFiltersClick && (
        <button
          type="button"
          onClick={onMobileFiltersClick}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan/40 bg-cyan/[0.06] text-[13px] uppercase tracking-[0.12em] [font-family:var(--font-orbitron)] font-bold text-cyan transition-colors hover:bg-cyan/10 lg:hidden"
        >
          <Filter className="h-4 w-4" />
          Bộ lọc
          {activeFilterCount > 0 && (
            <span
              data-testid="toolbar-active-count"
              className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan/20 px-1.5 text-[11px] font-bold text-cyan"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      <div className="hidden items-center gap-2.5 text-[13px] uppercase tracking-[0.12em] font-bold text-white lg:flex">
        <Filter className="h-4 w-4 text-cyan" />
        BỘ LỌC
      </div>

      <div className="ml-auto flex flex-1 items-center gap-3 text-[11px] uppercase tracking-[0.08em] [font-family:var(--font-mono)] text-white/40 lg:flex-none">
        <span className="hidden whitespace-nowrap lg:inline">Sắp xếp theo</span>
        <select
          aria-label="order products"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as CatalogSortOption)}
          className={`h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] pl-4 pr-9 text-[13px] [font-family:var(--font-mono)] text-white outline-none transition-colors hover:border-cyan/50 focus-visible:border-cyan/70 lg:h-9 lg:w-[200px] lg:rounded-md lg:pl-3 lg:pr-8 lg:text-[12px] ${SELECT_CHEVRON}`}
        >
          {SORT_ORDER.map((opt) => (
            <option key={opt} value={opt} className="bg-ink text-white">
              {SORT_LABELS[opt]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
