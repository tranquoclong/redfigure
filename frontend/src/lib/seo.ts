import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from './constants';

interface BuildPageMetadataParams {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  fallbackImage?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
}

export const STATIC_OG_FALLBACK = '/og-image.jpg';

export function buildPageMetadata(params: BuildPageMetadataParams): Metadata {
  const { title, description, path, image, fallbackImage, type = 'website', publishedTime, modifiedTime } = params;
  const url = `${SITE_URL}${path}`;
  const resolvedImage = image || fallbackImage || STATIC_OG_FALLBACK;
  const images = [{ url: resolvedImage, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: {
      index: true,
      follow: true,
      'max-snippet': -1 as unknown as undefined,
      'max-video-preview': -1 as unknown as undefined,
      'max-image-preview': 'large' as unknown as undefined,
    },
    openGraph: {
      type,
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'vi_VN',
      images,
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [resolvedImage],
    },
  };
}
