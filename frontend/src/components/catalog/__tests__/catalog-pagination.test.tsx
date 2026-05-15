import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogPagination } from '../catalog-pagination';

describe('CatalogPagination', () => {
  it('does not render when totalPages <= 1', () => {
    const { container } = render(
      <CatalogPagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  it('lists all pages when total <= 7', () => {
    render(
      <CatalogPagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Page ${i}`)).toBeInTheDocument();
    }
  });

  it('uses ellipsis when total > 7 and current is in the middle', () => {
    render(
      <CatalogPagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 9')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 10')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 11')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 20')).toBeInTheDocument();
    expect(screen.queryByLabelText('Page 5')).not.toBeInTheDocument();
  });

  it('current page has aria-current="page"', () => {
    render(
      <CatalogPagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Page 3')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables Previous page when on page 1', () => {
    render(
      <CatalogPagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables Next page when on last page', () => {
    render(
      <CatalogPagination currentPage={5} totalPages={5} onPageChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('clicking on page calls onPageChange with number', () => {
    const onPageChange = vi.fn();
    render(
      <CatalogPagination
        currentPage={1}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clicking on Next calls onPageChange(currentPage + 1)', () => {
    const onPageChange = vi.fn();
    render(
      <CatalogPagination
        currentPage={2}
        totalPages={5}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
