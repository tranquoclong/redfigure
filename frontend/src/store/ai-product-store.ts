'use client';

import { create } from 'zustand';

export interface AiMatchedAttribute {
  attributeValueId: string;
  attributeName: string;
  value: string;
  confidence: 'exact' | 'fuzzy';
  aiOriginal?: string;
}

export interface AiUnmatchedAttribute {
  attributeName: string;
  value: string;
  confidence: 'new';
}

export interface AiPreUploadedMedia {
  mediaFileId: string;
  thumb: string;
  card: string;
  gallery: string;
  full: string;
  alt?: string;
  title?: string;
  description?: string;
}

export interface AiProductData {
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  metaTitle?: string;
  seoKeywords: string[];
  altText: string[];
  imageTitles: string[];
  imageDescriptions: string[];
  matchedAttributes: AiMatchedAttribute[];
  unmatchedAttributes: AiUnmatchedAttribute[];
  brandId: string;
  collectionAttributeValueId?: string;

  preUploadedMedia?: AiPreUploadedMedia[];
}

interface AiProductState {
  data: AiProductData | null;
  setData: (data: AiProductData) => void;
  clear: () => void;
}

export const useAiProductStore = create<AiProductState>((set) => ({
  data: null,
  setData: (data) => set({ data }),
  clear: () => set({ data: null }),
}));
