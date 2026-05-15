import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiPostMock = vi.fn();
vi.mock('@/lib/api-client', () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
    get: vi.fn(),
  },
}));

vi.mock('./gallery-picker', () => ({
  GalleryPicker: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (media: {
      id: string;
      filename: string;
      thumb: string;
      card: string;
      gallery: string;
      full: string;
      alt: string | null;
    }) => void;
  }) =>
    open ? (
      <button
        type="button"
        data-testid="gallery-pick-btn"
        onClick={() =>
          onSelect({
            id: 'gal-1',
            filename: 'x.jpg',
            thumb: 'https://cdn.x.com/t.webp',
            card: 'https://cdn.x.com/c.webp',
            gallery: 'https://cdn.x.com/g.webp',
            full: 'https://cdn.x.com/f.webp',
            alt: null,
          })
        }
      >
        pick-from-gallery
      </button>
    ) : null,
}));

import { ImagePicker } from './image-picker';

describe('ImagePicker (single-image — issue #51)', () => {
  beforeEach(() => {
    apiPostMock.mockReset();
  });

  it('does not render preview when value=null', () => {
    render(<ImagePicker value={null} onChange={() => {}} />);
    expect(screen.queryByAltText('Preview')).toBeNull();
  });

  it('renders preview when value is a URL', () => {
    render(<ImagePicker value="https://cdn.x.com/y.jpg" onChange={() => {}} />);
    const img = screen.getByAltText('Preview') as HTMLImageElement;
    expect(img.src).toContain('https://cdn.x.com/y.jpg');
  });

  it('has Upload and Gallery buttons', () => {
    render(<ImagePicker value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument();
  });

  it('clicking remove calls onChange(null)', () => {
    const onChange = vi.fn();
    render(<ImagePicker value="https://cdn.x.com/y.jpg" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('selects from gallery and calls onChange with "full" URL variant by default', async () => {
    const onChange = vi.fn();
    render(<ImagePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /gallery/i }));
    fireEvent.click(await screen.findByTestId('gallery-pick-btn'));
    expect(onChange).toHaveBeenCalledWith('https://cdn.x.com/f.webp');
  });

  it('respects variant="card" prop in gallery selection', async () => {
    const onChange = vi.fn();
    render(<ImagePicker value={null} onChange={onChange} variant="card" />);
    fireEvent.click(screen.getByRole('button', { name: /gallery/i }));
    fireEvent.click(await screen.findByTestId('gallery-pick-btn'));
    expect(onChange).toHaveBeenCalledWith('https://cdn.x.com/c.webp');
  });

  it('upload via file input triggers api.post("/media/upload") and calls onChange with URL variant', async () => {
    apiPostMock.mockResolvedValue({
      data: {
        data: {
          id: 'new-1',
          thumb: 'https://cdn.x.com/new-t.webp',
          card: 'https://cdn.x.com/new-c.webp',
          gallery: 'https://cdn.x.com/new-g.webp',
          full: 'https://cdn.x.com/new-f.webp',
        },
      },
    });
    const onChange = vi.fn();
    render(<ImagePicker value={null} onChange={onChange} />);

    const file = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(apiPostMock).toHaveBeenCalled());
    expect(apiPostMock.mock.calls[0][0]).toBe('/media/upload');
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('https://cdn.x.com/new-f.webp'),
    );
  });

  it('displays helperText when provided', () => {
    render(
      <ImagePicker
        value={null}
        onChange={() => {}}
        helperText="Recommended format 1200x630"
      />,
    );
    expect(
      screen.getByText('Recommended format 1200x630'),
    ).toBeInTheDocument();
  });
});
