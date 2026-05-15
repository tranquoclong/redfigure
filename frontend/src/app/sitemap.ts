import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

const API_URL =
  process.env.INTERNAL_API_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:4000';

interface ProductLite {
  slug: string;
  updatedAt: string;
}

interface CategoryLite {
  slug: string;
  updatedAt?: string;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/returns`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const productsData = await fetchJson<{ data?: ProductLite[] } | ProductLite[]>(
    '/products?perPage=50000&page=1',
  );
  const products: ProductLite[] = productsData
    ? Array.isArray(productsData) ? productsData : (productsData.data ?? [])
    : [];
  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/p/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const [categories, tags, brands] = await Promise.all([
    fetchJson<CategoryLite[]>('/categories'),
    fetchJson<CategoryLite[]>('/tags'),
    fetchJson<CategoryLite[]>('/brands'),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = (categories ?? []).map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));
  const tagEntries: MetadataRoute.Sitemap = (tags ?? []).map((t) => ({
    url: `${SITE_URL}/t/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));
  const brandEntries: MetadataRoute.Sitemap = (brands ?? []).map((b) => ({
    url: `${SITE_URL}/m/${b.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const posts = await fetchJson<Array<{ slug: string; updatedAt: string; isPublished: boolean }>>(
    '/blog?published=true',
  );
  const blogEntries: MetadataRoute.Sitemap = (posts ?? [])
    .filter((p) => p.isPublished !== false)
    .map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.5,
    }));

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...tagEntries,
    ...brandEntries,
    ...blogEntries,
  ];
}
