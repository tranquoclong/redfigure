'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type CatalogSortOption =
  | 'alphabetical'
  | 'price-asc'
  | 'price-desc'
  | 'recent'
  | 'sold';

export interface CatalogFilters {
  brandId: string | undefined;
  attributes: string[];
  priceMin: number | undefined;
  priceMax: number | undefined;
  featured: boolean;
  onSale: boolean;
  sort: CatalogSortOption;
  page: number;
}

export interface CatalogChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface UseCatalogFiltersOptions {

  fixedBrandId?: string;

  fixedCategoryId?: string;

  fixedTagId?: string;

  brandsForLabels?: ReadonlyArray<{ id: string; name: string }>;
  attributesForLabels?: ReadonlyArray<{
    values: ReadonlyArray<{ id: string; value: string }>;
  }>;
}

const ALLOWED_SORTS: readonly CatalogSortOption[] = [
  'alphabetical',
  'price-asc',
  'price-desc',
  'recent',
  'sold',
] as const;

const PRICE_DEBOUNCE_MS = 400;

function parseFilters(
  sp: URLSearchParams,
  options: UseCatalogFiltersOptions,
): CatalogFilters {
  const sortRaw = sp.get('sort');
  const sort = ALLOWED_SORTS.includes(sortRaw as CatalogSortOption)
    ? (sortRaw as CatalogSortOption)
    : 'alphabetical';

  const pageRaw = parseInt(sp.get('page') ?? '', 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const attrsRaw = sp.get('attributes');
  const attributes = attrsRaw
    ? attrsRaw
      .split(',')
      .slice(0, 20)
      .filter((a) => a.length > 0 && a.length < 100)
    : [];

  const priceMinRaw = sp.get('priceMin');
  const priceMaxRaw = sp.get('priceMax');
  const priceMinNum = priceMinRaw ? Number(priceMinRaw) : NaN;
  const priceMaxNum = priceMaxRaw ? Number(priceMaxRaw) : NaN;

  const brandId =
    options.fixedBrandId ?? (sp.get('brandId') || undefined);

  return {
    brandId,
    attributes,
    priceMin: Number.isFinite(priceMinNum) ? priceMinNum : undefined,
    priceMax: Number.isFinite(priceMaxNum) ? priceMaxNum : undefined,
    featured: sp.get('featured') === 'true',
    onSale: sp.get('onSale') === 'true',
    sort,
    page,
  };
}

function serializeFilters(
  filters: CatalogFilters,
  options: UseCatalogFiltersOptions,
): URLSearchParams {
  const sp = new URLSearchParams();

  if (filters.brandId && filters.brandId !== options.fixedBrandId) {
    sp.set('brandId', filters.brandId);
  }
  if (filters.attributes.length > 0) {
    sp.set('attributes', filters.attributes.join(','));
  }
  if (filters.priceMin !== undefined) {
    sp.set('priceMin', String(filters.priceMin));
  }
  if (filters.priceMax !== undefined) {
    sp.set('priceMax', String(filters.priceMax));
  }
  if (filters.featured) sp.set('featured', 'true');
  if (filters.onSale) sp.set('onSale', 'true');
  if (filters.sort !== 'alphabetical') sp.set('sort', filters.sort);
  if (filters.page > 1) sp.set('page', String(filters.page));
  return sp;
}

export function useCatalogFilters(
  options: UseCatalogFiltersOptions = {},
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<CatalogFilters>(() =>
    parseFilters(
      searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams(),
      options,
    ),
  );

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const urlFilters = parseFilters(
      new URLSearchParams(searchParams.toString()),
      optionsRef.current,
    );
    const currentSerialized = serializeFilters(
      filtersRef.current,
      optionsRef.current,
    ).toString();
    const urlSerialized = serializeFilters(
      urlFilters,
      optionsRef.current,
    ).toString();
    if (currentSerialized !== urlSerialized) {
      setFiltersState(urlFilters);
      filtersRef.current = urlFilters;
    }
  }, [searchParams]);

  const pushToUrl = useCallback(
    (next: CatalogFilters) => {
      const sp = serializeFilters(next, optionsRef.current);
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [router, pathname],
  );

  const setFilter = useCallback(
    <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => {
      const prev = filtersRef.current;
      const next: CatalogFilters = {
        ...prev,
        [key]: value,

        page: key === 'page' ? (value as number) : 1,
      };
      setFiltersState(next);
      filtersRef.current = next;

      if (key === 'priceMin' || key === 'priceMax') {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          pushToUrl(next);
        }, PRICE_DEBOUNCE_MS);
      } else {

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pushToUrl(next);
      }
    },
    [pushToUrl],
  );

  const clearAll = useCallback(() => {
    const reset: CatalogFilters = {
      brandId: optionsRef.current.fixedBrandId,
      attributes: [],
      priceMin: undefined,
      priceMax: undefined,
      featured: false,
      onSale: false,
      sort: filtersRef.current.sort,
      page: 1,
    };
    setFiltersState(reset);
    filtersRef.current = reset;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pushToUrl(reset);
  }, [pushToUrl]);

  const activeChips: CatalogChip[] = useMemo(() => {
    const chips: CatalogChip[] = [];

    if (filters.onSale) {
      chips.push({
        id: 'on-sale',
        label: 'Đang giảm giá',
        onRemove: () => setFilter('onSale', false),
      });
    }

    if (filters.featured) {
      chips.push({
        id: 'featured',
        label: 'Nổi bật',
        onRemove: () => setFilter('featured', false),
      });
    }

    if (filters.brandId && filters.brandId !== options.fixedBrandId) {
      const brand = options.brandsForLabels?.find(
        (b) => b.id === filters.brandId,
      );
      chips.push({
        id: `brand-${filters.brandId}`,
        label: brand?.name ?? 'Thương hiệu',
        onRemove: () => setFilter('brandId', undefined),
      });
    }

    if (filters.attributes.length > 0 && options.attributesForLabels) {
      const allValues = options.attributesForLabels.flatMap((a) => a.values);
      filters.attributes.forEach((attrId) => {
        const val = allValues.find((v) => v.id === attrId);
        chips.push({
          id: `attr-${attrId}`,
          label: val?.value ?? 'Thuộc tính',
          onRemove: () =>
            setFilter(
              'attributes',
              filters.attributes.filter((id) => id !== attrId),
            ),
        });
      });
    }

    if (filters.priceMin !== undefined) {
      chips.push({
        id: 'priceMin',
        label: `≥  ${filters.priceMin} VNĐ`,
        onRemove: () => setFilter('priceMin', undefined),
      });
    }

    if (filters.priceMax !== undefined) {
      chips.push({
        id: 'priceMax',
        label: `≤ ${filters.priceMax} VNĐ`,
        onRemove: () => setFilter('priceMax', undefined),
      });
    }

    return chips;
  }, [
    filters,
    options.fixedBrandId,
    options.brandsForLabels,
    options.attributesForLabels,
    setFilter,
  ]);

  const hasActiveFilters = activeChips.length > 0;

  return {
    filters,
    setFilter,
    clearAll,
    activeChips,
    hasActiveFilters,
  };
}
