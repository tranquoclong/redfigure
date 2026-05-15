'use server';

import { updateTag } from 'next/cache';
import {
  TOPBAR_CACHE_TAG,
  MARQUEE_CACHE_TAG,
  GENERAL_CACHE_TAG,
  BANNERS_CACHE_TAG,
  FEATURED_CATEGORIES_CACHE_TAG,
  MEGAMENU_CACHE_TAG,
  FOOTER_CACHE_TAG,
  LOGIN_FEATURED_CACHE_TAG,
} from '@/lib/site-content';
import { HOME_BLOCKS_CACHE_TAG } from '@/lib/home-blocks';

async function safeUpdateTag(tag: string): Promise<void> {
  try {
    updateTag(tag);
  } catch (err) {
    console.error(`[revalidate] updateTag(${tag}) failed:`, err);
  }
}

export async function revalidateTopBar(): Promise<void> {
  await safeUpdateTag(TOPBAR_CACHE_TAG);
}

export async function revalidateMarquee(): Promise<void> {
  await safeUpdateTag(MARQUEE_CACHE_TAG);
}

export async function revalidateGeneral(): Promise<void> {
  await safeUpdateTag(GENERAL_CACHE_TAG);

  await safeUpdateTag(LOGIN_FEATURED_CACHE_TAG);
}

export async function revalidateBanners(): Promise<void> {
  await safeUpdateTag(BANNERS_CACHE_TAG);
}

export async function revalidateFeaturedCategories(): Promise<void> {
  await safeUpdateTag(FEATURED_CATEGORIES_CACHE_TAG);
}

export async function revalidateMegaMenu(): Promise<void> {
  await safeUpdateTag(MEGAMENU_CACHE_TAG);
}

export async function revalidateFooter(): Promise<void> {
  await safeUpdateTag(FOOTER_CACHE_TAG);
}

export async function revalidateHomeBlocks(): Promise<void> {
  await safeUpdateTag(HOME_BLOCKS_CACHE_TAG);
}

export async function revalidateAllSite(): Promise<void> {
  const { revalidatePath } = await import('next/cache');
  await Promise.all([
    safeUpdateTag(TOPBAR_CACHE_TAG),
    safeUpdateTag(MARQUEE_CACHE_TAG),
    safeUpdateTag(GENERAL_CACHE_TAG),
    safeUpdateTag(BANNERS_CACHE_TAG),
    safeUpdateTag(FEATURED_CATEGORIES_CACHE_TAG),
    safeUpdateTag(MEGAMENU_CACHE_TAG),
    safeUpdateTag(FOOTER_CACHE_TAG),
    safeUpdateTag(LOGIN_FEATURED_CACHE_TAG),
    safeUpdateTag(HOME_BLOCKS_CACHE_TAG),
  ]);

  try {
    revalidatePath('/', 'page');
  } catch {

  }
}
