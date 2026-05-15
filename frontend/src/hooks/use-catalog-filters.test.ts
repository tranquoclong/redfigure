import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCatalogFilters } from './use-catalog-filters';

let currentSearchParams = new URLSearchParams();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/products',
}));

beforeEach(() => {
  currentSearchParams = new URLSearchParams();
  mockReplace.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCatalogFilters — initial parse', () => {
  it('default empty URL → default filters', () => {
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters).toMatchObject({
      brandId: undefined,
      attributes: [],
      priceMin: undefined,
      priceMax: undefined,
      featured: false,
      onSale: false,
      sort: 'alphabetical',
      page: 1,
    });
  });

  it('parses brandId from URL', () => {
    currentSearchParams = new URLSearchParams('brandId=brand123');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.brandId).toBe('brand123');
  });

  it('parses attributes (comma-separated) from URL', () => {
    currentSearchParams = new URLSearchParams('attributes=a1,a2,a3');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.attributes).toEqual(['a1', 'a2', 'a3']);
  });

  it('parses priceMin/priceMax from URL', () => {
    currentSearchParams = new URLSearchParams('priceMin=100&priceMax=500');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.priceMin).toBe(100);
    expect(result.current.filters.priceMax).toBe(500);
  });

  it('parses featured/onSale toggles from URL', () => {
    currentSearchParams = new URLSearchParams('featured=true&onSale=true');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.featured).toBe(true);
    expect(result.current.filters.onSale).toBe(true);
  });

  it('parses sort and page from URL', () => {
    currentSearchParams = new URLSearchParams('sort=sold&page=3');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.sort).toBe('sold');
    expect(result.current.filters.page).toBe(3);
  });

  it('invalid sort falls back to alphabetical', () => {
    currentSearchParams = new URLSearchParams('sort=garbage');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.sort).toBe('alphabetical');
  });

  it('invalid page (NaN, negative) falls back to 1', () => {
    currentSearchParams = new URLSearchParams('page=abc');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.page).toBe(1);
  });

  it('invalid priceMin (non-numeric) falls back to undefined', () => {
    currentSearchParams = new URLSearchParams('priceMin=foo');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.priceMin).toBeUndefined();
  });
});

describe('useCatalogFilters — fixed context (page-level)', () => {
  it('fixedBrandId overrides URL brandId param', () => {
    currentSearchParams = new URLSearchParams('brandId=fromUrl');
    const { result } = renderHook(() =>
      useCatalogFilters({ fixedBrandId: 'fixed-brand' }),
    );
    expect(result.current.filters.brandId).toBe('fixed-brand');
  });

  it('fixedBrandId DOES NOT appear in activeChips (not a removable filter)', () => {
    const { result } = renderHook(() =>
      useCatalogFilters({
        fixedBrandId: 'fixed-brand',
        brandsForLabels: [{ id: 'fixed-brand', name: 'Fixed Brand' }],
      }),
    );
    expect(result.current.activeChips.find((c) => c.id.startsWith('brand-'))).toBeUndefined();
  });
});

describe('useCatalogFilters — setFilter', () => {
  it('updates state immediately for non-price changes', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('onSale', true);
    });
    expect(result.current.filters.onSale).toBe(true);
  });

  it('calls router.replace immediately for non-price changes', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('featured', true);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('featured=true'),
      expect.objectContaining({ scroll: false }),
    );
  });

  it('400ms debounce for priceMin/priceMax (immediate state, delayed URL)', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('priceMin', 100);
    });

    expect(result.current.filters.priceMin).toBe(100);

    expect(mockReplace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('priceMin=100'),
      expect.anything(),
    );
  });

  it('fast typing in priceMin debounces on last value', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('priceMin', 1);
      result.current.setFilter('priceMin', 12);
      result.current.setFilter('priceMin', 123);
    });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('priceMin=123'),
      expect.anything(),
    );
  });

  it('changing filter resets page=1 (unless changing page itself)', () => {
    currentSearchParams = new URLSearchParams('page=5');
    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.filters.page).toBe(5);
    act(() => {
      result.current.setFilter('onSale', true);
    });
    expect(result.current.filters.page).toBe(1);
  });

  it('setFilter(page, n) DOES NOT reset page itself', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('page', 4);
    });
    expect(result.current.filters.page).toBe(4);
  });
});

describe('useCatalogFilters — clearAll', () => {
  it('clears all filters (preserving sort)', () => {
    currentSearchParams = new URLSearchParams(
      'brandId=b1&attributes=a1,a2&priceMin=100&featured=true&sort=sold&page=3',
    );
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.filters).toMatchObject({
      brandId: undefined,
      attributes: [],
      priceMin: undefined,
      priceMax: undefined,
      featured: false,
      onSale: false,
      sort: 'sold',
      page: 1,
    });
  });

  it('clearAll calls router.replace with clean URL', () => {
    currentSearchParams = new URLSearchParams('featured=true&onSale=true');
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.clearAll();
    });
    expect(mockReplace).toHaveBeenCalled();
    const lastCall = mockReplace.mock.calls.at(-1)![0] as string;
    expect(lastCall).not.toContain('featured');
    expect(lastCall).not.toContain('onSale');
  });
});

describe('useCatalogFilters — activeChips', () => {
  it('returns chip for onSale when true', () => {
    currentSearchParams = new URLSearchParams('onSale=true');
    const { result } = renderHook(() => useCatalogFilters());
    const chip = result.current.activeChips.find((c) => c.id === 'on-sale');
    expect(chip).toBeDefined();
    expect(chip!.label).toMatch(/promo/i);
  });

  it('returns chip for featured when true', () => {
    currentSearchParams = new URLSearchParams('featured=true');
    const { result } = renderHook(() => useCatalogFilters());
    const chip = result.current.activeChips.find((c) => c.id === 'featured');
    expect(chip).toBeDefined();
    expect(chip!.label).toMatch(/featured/i);
  });

  it('chip onRemove deactivates filter', () => {
    currentSearchParams = new URLSearchParams('onSale=true');
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.activeChips
        .find((c) => c.id === 'on-sale')!
        .onRemove();
    });
    expect(result.current.filters.onSale).toBe(false);
  });

  it('brand chip uses label from brandsForLabels', () => {
    currentSearchParams = new URLSearchParams('brandId=brand1');
    const { result } = renderHook(() =>
      useCatalogFilters({
        brandsForLabels: [
          { id: 'brand1', name: 'Belksasar' },
          { id: 'brand2', name: 'Other' },
        ],
      }),
    );
    const chip = result.current.activeChips.find((c) => c.id === 'brand-brand1');
    expect(chip?.label).toBe('Belksasar');
  });

  it('attribute chip uses label from attributesForLabels', () => {
    currentSearchParams = new URLSearchParams('attributes=val1,val2');
    const { result } = renderHook(() =>
      useCatalogFilters({
        attributesForLabels: [
          {
            values: [
              { id: 'val1', value: 'Red' },
              { id: 'val2', value: 'Blue' },
              { id: 'val3', value: 'Green' },
            ],
          },
        ],
      }),
    );
    expect(result.current.activeChips.find((c) => c.id === 'attr-val1')?.label).toBe(
      'Red',
    );
    expect(result.current.activeChips.find((c) => c.id === 'attr-val2')?.label).toBe(
      'Blue',
    );
  });

  it('hasActiveFilters reflects activeChips length > 0', () => {
    const { result, rerender } = renderHook(() => useCatalogFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => {
      result.current.setFilter('onSale', true);
    });
    rerender();
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('priceMin chip shows formatted value', () => {
    currentSearchParams = new URLSearchParams('priceMin=150');
    const { result } = renderHook(() => useCatalogFilters());
    const chip = result.current.activeChips.find((c) => c.id === 'priceMin');
    expect(chip?.label).toContain('150');
  });
});

describe('useCatalogFilters — URL serialization', () => {
  it('skips params with default values', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('onSale', true);
    });
    const lastCall = mockReplace.mock.calls.at(-1)![0] as string;

    expect(lastCall).not.toContain('sort=alphabetical');

    expect(lastCall).not.toContain('page=1');
  });

  it('serializes attributes as CSV', () => {
    const { result } = renderHook(() => useCatalogFilters());
    act(() => {
      result.current.setFilter('attributes', ['a1', 'a2', 'a3']);
    });
    const lastCall = mockReplace.mock.calls.at(-1)![0] as string;
    expect(lastCall).toContain('attributes=a1%2Ca2%2Ca3');
  });

  it('fixedBrandId DOES NOT appear in serialized URL (not a param)', () => {
    const { result } = renderHook(() =>
      useCatalogFilters({ fixedBrandId: 'fixed-brand' }),
    );
    act(() => {
      result.current.setFilter('onSale', true);
    });
    const lastCall = mockReplace.mock.calls.at(-1)![0] as string;
    expect(lastCall).not.toContain('brandId=fixed-brand');
  });
});
