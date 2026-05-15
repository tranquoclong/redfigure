import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogToolbar } from '../catalog-toolbar';

describe('CatalogToolbar', () => {
  it('exposes sort dropdown with aria-label', () => {
    render(
      <CatalogToolbar sort="alphabetical" onSortChange={vi.fn()} />,
    );
    expect(
      screen.getByRole('combobox', { name: 'Sort products' }),
    ).toBeInTheDocument();
  });

  it('DOES NOT render mobile Filters button when onMobileFiltersClick=undefined', () => {
    render(
      <CatalogToolbar sort="alphabetical" onSortChange={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /filters/i })).toBeNull();
  });

  it('renders mobile Filters button when handler provided', () => {
    const onMobileFiltersClick = vi.fn();
    render(
      <CatalogToolbar
        sort="alphabetical"
        onSortChange={vi.fn()}
        onMobileFiltersClick={onMobileFiltersClick}
      />,
    );
    const btn = screen.getByRole('button', { name: /filters/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onMobileFiltersClick).toHaveBeenCalled();
  });

  it('shows activeFilterCount badge when > 0', () => {
    render(
      <CatalogToolbar
        sort="alphabetical"
        onSortChange={vi.fn()}
        onMobileFiltersClick={vi.fn()}
        activeFilterCount={3}
      />,
    );
    expect(screen.getByTestId('toolbar-active-count')).toHaveTextContent('3');
  });

  it('omits activeFilterCount badge when 0', () => {
    render(
      <CatalogToolbar
        sort="alphabetical"
        onSortChange={vi.fn()}
        onMobileFiltersClick={vi.fn()}
        activeFilterCount={0}
      />,
    );
    expect(screen.queryByTestId('toolbar-active-count')).toBeNull();
  });

  it('onSortChange triggers when user changes option', () => {
    const onSortChange = vi.fn();
    render(
      <CatalogToolbar sort="alphabetical" onSortChange={onSortChange} />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort products' }), {
      target: { value: 'sold' },
    });
    expect(onSortChange).toHaveBeenCalledWith('sold');
  });
});
