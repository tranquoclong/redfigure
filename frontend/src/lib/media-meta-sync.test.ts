import { describe, it, expect } from 'vitest';
import {
  applyMediaMetaPatch,
  applyMediaMetaPatchToVariations,
  type MediaMetaPatch,
  type ImageWithMeta,
  type VariationWithImages,
} from './media-meta-sync';

function img(
  mediaFileId: string,
  overrides: Partial<ImageWithMeta> = {},
): ImageWithMeta {
  return {
    mediaFileId,
    alt: undefined,
    title: undefined,
    description: undefined,
    caption: undefined,
    ...overrides,
  };
}

describe('applyMediaMetaPatch', () => {
  it('updates the single matching mediaFileId', () => {
    const images = [img('A'), img('B')];
    const patch: MediaMetaPatch = { alt: 'new alt' };

    const result = applyMediaMetaPatch(images, 'A', patch);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ mediaFileId: 'A', alt: 'new alt' });
    expect(result[1]).toEqual(images[1]);
  });

  it('updates every instance of a duplicated mediaFileId', () => {
    const images = [img('A'), img('B'), img('A')];
    const patch: MediaMetaPatch = { caption: 'attention' };

    const result = applyMediaMetaPatch(images, 'A', patch);

    expect(result[0]).toMatchObject({ mediaFileId: 'A', caption: 'attention' });
    expect(result[1]).toEqual(images[1]);
    expect(result[2]).toMatchObject({ mediaFileId: 'A', caption: 'attention' });
  });

  it('returns the same array reference if no matches', () => {
    const images = [img('X'), img('Y')];
    const patch: MediaMetaPatch = { alt: 'foo' };

    const result = applyMediaMetaPatch(images, 'Z', patch);

    expect(result).toBe(images);
  });

  it('preserves non-patched fields on the matching entry', () => {
    const images = [
      img('A', { alt: 'old', title: 'keep', description: 'keep-desc' }),
    ];
    const patch: MediaMetaPatch = { alt: 'new' };

    const result = applyMediaMetaPatch(images, 'A', patch);

    expect(result[0]).toMatchObject({
      alt: 'new',
      title: 'keep',
      description: 'keep-desc',
    });
  });

  it('supports multi-field patch', () => {
    const images = [img('A', { alt: 'old', caption: 'old-cap' })];
    const patch: MediaMetaPatch = {
      alt: 'new-alt',
      title: 'new-title',
      caption: 'new-cap',
    };

    const result = applyMediaMetaPatch(images, 'A', patch);

    expect(result[0]).toMatchObject({
      mediaFileId: 'A',
      alt: 'new-alt',
      title: 'new-title',
      caption: 'new-cap',
    });
  });

  it('allows explicitly clearing a field via empty string', () => {

    const images = [img('A', { alt: 'old', caption: 'old-cap' })];
    const patch: MediaMetaPatch = { alt: '' };

    const result = applyMediaMetaPatch(images, 'A', patch);

    expect(result[0].alt).toBe('');
    expect(result[0].caption).toBe('old-cap');
  });
});

describe('applyMediaMetaPatchToVariations', () => {

  interface TestVariation extends VariationWithImages {
    id: string;
    sku?: string;
  }

  function variation(id: string, imageIds: string[]): TestVariation {
    return {
      id,
      images: imageIds.map((mfId) => img(mfId)),
    };
  }

  it('propagates patch to every variation containing the mediaFileId', () => {
    const variations: TestVariation[] = [
      variation('v1', ['A', 'B']),
      variation('v2', ['C']),
      variation('v3', ['A', 'D']),
    ];
    const patch: MediaMetaPatch = { caption: 'shared' };

    const result = applyMediaMetaPatchToVariations(variations, 'A', patch);

    expect(result[0].images?.[0]).toMatchObject({ mediaFileId: 'A', caption: 'shared' });
    expect(result[0].images?.[1]).toEqual(variations[0].images?.[1]);

    expect(result[1]).toBe(variations[1]);

    expect(result[2].images?.[0]).toMatchObject({ mediaFileId: 'A', caption: 'shared' });
    expect(result[2].images?.[1]).toEqual(variations[2].images?.[1]);
  });

  it('returns the same variations reference when no variation contains the mediaFileId', () => {
    const variations: TestVariation[] = [
      variation('v1', ['A', 'B']),
      variation('v2', ['C']),
    ];
    const patch: MediaMetaPatch = { alt: 'foo' };

    const result = applyMediaMetaPatchToVariations(variations, 'Z', patch);

    expect(result).toBe(variations);
  });

  it('handles variations with undefined images array', () => {
    const variations: TestVariation[] = [
      { id: 'v1' },
      variation('v2', ['A']),
    ];
    const patch: MediaMetaPatch = { alt: 'new' };

    const result = applyMediaMetaPatchToVariations(variations, 'A', patch);

    expect(result[0]).toBe(variations[0]);
    expect(result[1].images?.[0]).toMatchObject({ alt: 'new' });
  });

  it('preserves variation-level fields other than images', () => {
    const variations: TestVariation[] = [
      { id: 'v1', sku: 'SKU-1', images: [img('A')] },
    ];
    const patch: MediaMetaPatch = { alt: 'x' };

    const result = applyMediaMetaPatchToVariations(variations, 'A', patch);

    expect(result[0]).toMatchObject({ id: 'v1', sku: 'SKU-1' });
    expect(result[0].images?.[0]).toMatchObject({ alt: 'x' });
  });
});
