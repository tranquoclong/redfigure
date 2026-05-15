import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogFilters, type CatalogFiltersData } from '../catalog-filters';
import type { CatalogFilters as State } from '@/hooks/use-catalog-filters';

const DEFAULT_STATE: State = {
  brandId: undefined,
  attributes: [],
  priceMin: undefined,
  priceMax: undefined,
  featured: false,
  onSale: false,
  sort: 'alphabetical',
  page: 1,
};

const SAMPLE_DATA: CatalogFiltersData = {
  brands: [
    { id: 'b1', name: 'Belksasar', slug: 'belksasar', count: 10 },
    { id: 'b2', name: 'Torrida Minis', slug: 'torrida', count: 5 },
  ],
  attributes: [
    {
      id: 'a1',
      name: 'Accessory',
      slug: 'acessorio',
      values: [
        { id: 'v1', value: 'Dagger', slug: 'adaga', count: 3 },
        { id: 'v2', value: 'Sword', slug: 'espada', count: 4 },
      ],
    },
  ],
  priceRange: { min: 10, max: 500 },
};

describe('CatalogFilters — toggles', () => {
  it('toggle On sale triggers onFilterChange("onSale", true)', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/on sale/i));
    expect(onFilterChange).toHaveBeenCalledWith('onSale', true);
  });

  it('toggle Featured triggers onFilterChange("featured", true)', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/featured/i));
    expect(onFilterChange).toHaveBeenCalledWith('featured', true);
  });

  it('toggles reflect initial state', () => {
    render(
      <CatalogFilters
        filters={{ ...DEFAULT_STATE, onSale: true, featured: true }}
        data={SAMPLE_DATA}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/on sale/i)).toBeChecked();
    expect(screen.getByLabelText(/featured/i)).toBeChecked();
  });
});

describe('CatalogFilters — price', () => {
  it('priceMin input triggers onFilterChange with Number', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Minimum price'), {
      target: { value: '100' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('priceMin', 100);
  });

  it('clearing priceMax triggers undefined', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={{ ...DEFAULT_STATE, priceMax: 300 }}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Maximum price'), {
      target: { value: '' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('priceMax', undefined);
  });

  it('omits price section when priceRange.max=0', () => {
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={{ ...SAMPLE_DATA, priceRange: { min: 0, max: 0 } }}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Minimum price')).toBeNull();
  });
});

describe('CatalogFilters — brand', () => {
  it('renders brands with count and triggers onFilterChange', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    expect(screen.getByText(/Belksasar/)).toBeInTheDocument();
    expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Belksasar/));
    expect(onFilterChange).toHaveBeenCalledWith('brandId', 'b1');
  });

  it('hideBrandFilter omits brand section', () => {
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={vi.fn()}
        hideBrandFilter
      />,
    );
    expect(screen.queryByText(/Belksasar/)).toBeNull();
  });
});

describe('CatalogFilters — dynamic attributes', () => {
  it('toggle attribute adds to array', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Dagger/));
    expect(onFilterChange).toHaveBeenCalledWith('attributes', ['v1']);
  });

  it('toggle existing attribute removes from array', () => {
    const onFilterChange = vi.fn();
    render(
      <CatalogFilters
        filters={{ ...DEFAULT_STATE, attributes: ['v1', 'v2'] }}
        data={SAMPLE_DATA}
        onFilterChange={onFilterChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Dagger/));
    expect(onFilterChange).toHaveBeenCalledWith('attributes', ['v2']);
  });
});

describe('CatalogFilters — no data', () => {
  it('renders only toggles when data=null', () => {
    render(
      <CatalogFilters
        filters={DEFAULT_STATE}
        data={null}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/on sale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/featured/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Minimum price')).toBeNull();
  });
});
