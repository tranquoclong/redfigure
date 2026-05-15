import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogLoadMore } from '../catalog-load-more';

describe('CatalogLoadMore', () => {
  it('does not render when hasMore=false', () => {
    const { container } = render(
      <CatalogLoadMore hasMore={false} onClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Load more" button when hasMore=true', () => {
    render(<CatalogLoadMore hasMore onClick={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /load more/i }),
    ).toBeInTheDocument();
  });

  it('shows remaining count when provided', () => {
    render(<CatalogLoadMore hasMore remaining={20} onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('20');
  });

  it('omits remaining when undefined', () => {
    render(<CatalogLoadMore hasMore onClick={vi.fn()} />);
    expect(screen.getByRole('button').textContent).not.toMatch(/\(\d+\)/);
  });

  it('omits remaining=0', () => {
    render(<CatalogLoadMore hasMore remaining={0} onClick={vi.fn()} />);
    expect(screen.getByRole('button').textContent).not.toMatch(/\(0\)/);
  });

  it('click calls onClick', () => {
    const onClick = vi.fn();
    render(<CatalogLoadMore hasMore onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('disable + loading state', () => {
    render(<CatalogLoadMore hasMore loading onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/loading/i);
  });
});
