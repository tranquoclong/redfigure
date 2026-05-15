import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogAppliedChips } from '../catalog-applied-chips';

describe('CatalogAppliedChips', () => {
  it('does not render when no chips', () => {
    const { container } = render(
      <CatalogAppliedChips chips={[]} onClearAll={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders passed chips + "Applied filters:" label + "Clear all" button', () => {
    const chips = [
      { id: 'on-sale', label: 'On sale', onRemove: vi.fn() },
      { id: 'featured', label: 'Featured', onRemove: vi.fn() },
    ];
    render(<CatalogAppliedChips chips={chips} onClearAll={vi.fn()} />);
    expect(screen.getByText(/applied filters/i)).toBeInTheDocument();
    expect(screen.getByText(/clear all/i)).toBeInTheDocument();
    expect(screen.getByText('On sale')).toBeInTheDocument();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('clicking on chip calls corresponding onRemove', () => {
    const onRemove1 = vi.fn();
    const onRemove2 = vi.fn();
    const chips = [
      { id: 'a', label: 'Filter A', onRemove: onRemove1 },
      { id: 'b', label: 'Filter B', onRemove: onRemove2 },
    ];
    render(<CatalogAppliedChips chips={chips} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Remove filter: Filter A'));
    expect(onRemove1).toHaveBeenCalled();
    expect(onRemove2).not.toHaveBeenCalled();
  });

  it('clicking on Clear filters calls onClearAll', () => {
    const onClearAll = vi.fn();
    const chips = [{ id: 'a', label: 'A', onRemove: vi.fn() }];
    render(<CatalogAppliedChips chips={chips} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByText(/clear all/i));
    expect(onClearAll).toHaveBeenCalled();
  });
});
