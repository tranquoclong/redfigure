import { describe, it, expect } from 'vitest';
import { buildPageMetadata } from './seo';

function firstOgImageUrl(meta: ReturnType<typeof buildPageMetadata>): string | undefined {
  const images = meta.openGraph?.images;
  if (!images) return undefined;
  const arr = Array.isArray(images) ? images : [images];
  const first = arr[0];
  if (typeof first === 'string') return first;
  if (first instanceof URL) return first.toString();
  return first?.url ? String(first.url) : undefined;
}

describe('buildPageMetadata — Open Graph fallback (issue #49)', () => {
  it('uses specific image when provided', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
      image: 'https://cdn.x.com/pinups.jpg',
    });
    expect(firstOgImageUrl(meta)).toBe('https://cdn.x.com/pinups.jpg');
  });

  it('falls back to site-configured OG image when specific image is missing', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
      image: null,
      fallbackImage: 'https://cdn.x.com/site-default-og.jpg',
    });
    expect(firstOgImageUrl(meta)).toBe('https://cdn.x.com/site-default-og.jpg');
  });

  it('falls back to static /og-image.jpg when neither specific nor site-configured image exists', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
      image: null,
      fallbackImage: null,
    });
    expect(firstOgImageUrl(meta)).toBe('/og-image.jpg');
  });

  it('specific image takes precedence over site-configured fallback', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
      image: 'https://cdn.x.com/specific.jpg',
      fallbackImage: 'https://cdn.x.com/site-default.jpg',
    });
    expect(firstOgImageUrl(meta)).toBe('https://cdn.x.com/specific.jpg');
  });

  it('always emits an og image (SEO guarantee — scraper never sees page without og:image)', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
    });
    expect(firstOgImageUrl(meta)).toBeDefined();
  });

  it('uses resolved image in twitter card as well', () => {
    const meta = buildPageMetadata({
      title: 'Category',
      description: 'desc',
      path: '/c/pinups',
      image: null,
      fallbackImage: 'https://cdn.x.com/site-default-og.jpg',
    });
    const twitterImages = Array.isArray(meta.twitter?.images)
      ? meta.twitter!.images
      : [meta.twitter?.images];
    expect(twitterImages[0]).toBe('https://cdn.x.com/site-default-og.jpg');
  });
});
