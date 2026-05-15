import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

const DISALLOWED = ['/admin', '/my-account', '/checkout', '/api', '/cart'];

const AI_BOTS = ['GPTBot', 'PerplexityBot', 'Claude-Web', 'CCBot'];

const IS_STAGING = process.env.NEXT_PUBLIC_ENV === 'staging';

export default function robots(): MetadataRoute.Robots {
  if (IS_STAGING) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: SITE_URL,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOWED,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
