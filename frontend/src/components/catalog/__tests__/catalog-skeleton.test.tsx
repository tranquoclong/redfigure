import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatalogSkeleton } from '../catalog-skeleton';

describe('CatalogSkeleton', () => {
  it('renders 12 skeleton cards by default', () => {
    render(<CatalogSkeleton />);
    expect(screen.getAllByTestId('catalog-skeleton-card')).toHaveLength(12);
  });

  it('accepts custom count prop', () => {
    render(<CatalogSkeleton count={4} />);
    expect(screen.getAllByTestId('catalog-skeleton-card')).toHaveLength(4);
  });

  it('renders sidebar when withSidebar=true (default)', () => {
    const { container } = render(<CatalogSkeleton />);
    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(screen.getAllByTestId('catalog-skeleton-bar').length).toBeGreaterThan(0);
  });

  it('omits sidebar when withSidebar=false', () => {
    const { container } = render(<CatalogSkeleton withSidebar={false} />);
    expect(container.querySelector('aside')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('catalog-skeleton-bar')).toHaveLength(0);
  });

  it('cards have pulse animation classes and Glitch Duotone tokens', () => {
    render(<CatalogSkeleton count={1} />);
    const card = screen.getByTestId('catalog-skeleton-card');
    expect(card.className).toMatch(/animate-pulse/);
    expect(card.className).toMatch(/bg-purple/);
  });
});
