"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProductGalleryLightbox } from "./product-gallery-lightbox";

export interface GalleryImage {
  src: string;
  alt: string;

  badge?: string;

  caption?: string | null;
}

export interface ProductGalleryProps {
  images: GalleryImage[];
  isNsfw?: boolean;
  categoryLabel?: string;
  onShare?: () => void;
}

export function ProductGallery({
  images,
  isNsfw = false,
  categoryLabel,
  onShare,
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState<number>(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setStageHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = images.length;
  const current = images[selectedIndex] ?? images[0];

  const cycle = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => (prev + delta + total) % total);
    },
    [total],
  );

  if (!current) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[130px_1fr] lg:items-start">
        <div
          className="thumbs-scroll flex gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pr-1"
          style={
            stageHeight > 0
              ? ({ "--stage-h": `${stageHeight}px` } as React.CSSProperties)
              : undefined
          }
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedIndex(idx)}
              aria-label={`Xem ảnh ${idx + 1}`}
              className={cn(
                "relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border transition-all duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)] lg:w-full",
                selectedIndex === idx
                  ? "border-cyan/55 [box-shadow:var(--glow-cyan-sm)]"
                  : "border-white/10 hover:border-white/30",
              )}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="88px"
                className="object-cover"
              />
              {img.badge && (
                <span className="absolute bottom-1 left-1 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan">
                  {img.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          ref={stageRef}
          className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-soft"
        >
          <button
            type="button"
            aria-label="Phóng to ảnh"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 cursor-zoom-in"
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 50vw"
              className="object-cover"
            />
          </button>

          {(isNsfw || categoryLabel) && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
              {isNsfw && <Badge variant="nsfw">CAO CẤP</Badge>}
              {categoryLabel && (
                <Badge
                  variant="outline"
                  className="border-white/15 bg-ink/60 font-mono text-[10px] uppercase tracking-wider text-white"
                >
                  {categoryLabel}
                </Badge>
              )}
            </div>
          )}

          {current.caption && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex max-w-[80%] -translate-x-1/2 items-start gap-2 rounded-md border border-gold/45 bg-ink/85 px-3 py-1.5 backdrop-blur">
              <AlertTriangle className="size-3.5 shrink-0 text-gold mt-0.5" />
              <span className="min-w-0 text-[12px] leading-snug text-gold whitespace-normal break-words line-clamp-3">
                {current.caption}
              </span>
            </div>
          )}

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label="Chia sẻ"
              className="absolute right-3 top-3 z-10 rounded-full bg-ink/70 p-2 text-white/80 backdrop-blur transition hover:bg-ink hover:text-cyan"
            >
              <Share2 className="size-4" />
            </button>
          )}

          {total > 1 && (
            <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full border border-white/10 bg-ink/85 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan/85 backdrop-blur">
              {String(selectedIndex + 1).padStart(2, "0")} /{" "}
              {String(total).padStart(2, "0")}
            </div>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cycle(-1);
                }}
                aria-label="Ảnh trước đó"
                className="absolute left-3 top-1/2 z-10 size-9 -translate-y-1/2 rounded-full border border-white/15 bg-ink/85 text-lg leading-none text-white/85 backdrop-blur transition hover:border-cyan/60 hover:text-cyan"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cycle(1);
                }}
                aria-label="Ảnh tiếp theo"
                className="absolute right-3 top-1/2 z-10 size-9 -translate-y-1/2 rounded-full border border-white/15 bg-ink/85 text-lg leading-none text-white/85 backdrop-blur transition hover:border-cyan/60 hover:text-cyan"
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>

      <ProductGalleryLightbox
        images={images}
        initialIndex={selectedIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
