

export interface MediaMetaPatch {
  alt?: string;
  title?: string;
  description?: string;
  caption?: string;

  captionPresetId?: string | null;
}

export interface ImageWithMeta {
  mediaFileId: string;
  alt?: string;
  title?: string;
  description?: string;
  caption?: string;
}

export interface VariationWithImages {
  images?: ImageWithMeta[];
}

export function applyMediaMetaPatch<T extends ImageWithMeta>(
  images: T[],
  mediaFileId: string,
  patch: MediaMetaPatch,
): T[] {
  let touched = false;
  const next = images.map((img) => {
    if (img.mediaFileId !== mediaFileId) return img;
    touched = true;
    return { ...img, ...patch };
  });
  return touched ? next : images;
}

export function applyMediaMetaPatchToVariations<
  V extends { images?: I[] },
  I extends ImageWithMeta = ImageWithMeta,
>(variations: V[], mediaFileId: string, patch: MediaMetaPatch): V[] {
  let touched = false;
  const next = variations.map((v) => {
    if (!v.images || v.images.length === 0) return v;
    const nextImages = applyMediaMetaPatch(v.images, mediaFileId, patch);
    if (nextImages === v.images) return v;
    touched = true;
    return { ...v, images: nextImages };
  });
  return touched ? next : variations;
}
