"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id?: string;
  url?: string;
  altText?: string;
  isMain?: boolean;
  mediaFile?: {
    thumb: string;
    card: string;
    gallery: string;
    full: string;
    original?: string;
    alt?: string;
    caption?: string | null;

    captionPreset?: { id: string; name: string; text: string } | null;
  };
}

interface ProductGalleryProps {
  images: GalleryImage[];
  productName: string;
  selectedIndex: number;
  onSelectIndex: React.Dispatch<React.SetStateAction<number>>;
  zoomOpen: boolean;
  onZoomChange: (open: boolean) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCALE_STEP = 0.3;

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= 1) return;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      translateStart.current = { ...translate };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [scale, translate],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    setTranslate({
      x: translateStart.current.x + (e.clientX - panStart.current.x),
      y: translateStart.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div
      className={cn(
        "relative w-[90vw] h-[90vh] overflow-hidden",
        scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (scale <= 1) setScale(2);
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {scale > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 text-sm text-white/60 bg-black/40 rounded-full px-3 py-1 z-10 pointer-events-none">
          {Math.round(scale * 100)}%
        </div>
      )}
      <div
        className="relative w-full h-full transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="90vw"
          quality={95}
          draggable={false}
        />
      </div>
    </div>
  );
}

export function ProductGallery({
  images,
  productName,
  selectedIndex,
  onSelectIndex,
  zoomOpen,
  onZoomChange,
}: ProductGalleryProps) {
  const len = images.length;

  function goPrev() {
    onSelectIndex(selectedIndex > 0 ? selectedIndex - 1 : len - 1);
  }

  function goNext() {
    onSelectIndex(selectedIndex < len - 1 ? selectedIndex + 1 : 0);
  }

  useEffect(() => {
    if (!zoomOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onZoomChange(false);
      if (e.key === "ArrowLeft")
        onSelectIndex((prev: number) => (prev > 0 ? prev - 1 : len - 1));
      if (e.key === "ArrowRight")
        onSelectIndex((prev: number) => (prev < len - 1 ? prev + 1 : 0));
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomOpen, len, onZoomChange, onSelectIndex]);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.03] border border-purple/25 flex items-center justify-center">
        <p className="text-white/40">Không có ảnh</p>
      </div>
    );
  }

  const current = images[selectedIndex] ?? images[0];

  function getMainUrl(img: GalleryImage): string {
    return img.mediaFile?.gallery ?? img.url ?? "";
  }

  function getZoomUrl(img: GalleryImage): string {
    return (
      img.mediaFile?.original ??
      img.mediaFile?.full ??
      img.mediaFile?.gallery ??
      img.url ??
      ""
    );
  }

  function getThumbUrl(img: GalleryImage): string {
    return img.mediaFile?.thumb ?? img.url ?? "";
  }

  function getAlt(img: GalleryImage): string {
    return img.mediaFile?.alt ?? img.altText ?? productName;
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-3">
        {images.length > 1 && (
          <div className="col-span-2 relative">
            <div className="absolute inset-0 flex flex-col gap-2 overflow-y-auto overflow-x-hidden gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={img.id ?? i}
                  onClick={() => onSelectIndex(i)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border-2 transition-all shrink-0",
                    i === selectedIndex
                      ? "border-cyan shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                      : "border-white/10 hover:border-white/30",
                  )}
                >
                  <Image
                    src={getThumbUrl(img)}
                    alt={getAlt(img)}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={cn(
            "relative aspect-square overflow-hidden rounded-2xl border border-purple/25 bg-white/[0.03] group cursor-zoom-in",
            images.length > 1 ? "col-span-10" : "col-span-12",
          )}
          onClick={() => onZoomChange(true)}
        >
          <Image
            src={getMainUrl(current)}
            alt={getAlt(current)}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />

          {(current.mediaFile?.captionPreset?.text ||
            current.mediaFile?.caption) && (
            <div className="absolute top-4 left-4 right-4 pointer-events-none z-[1]">
              <div className="flex max-w-full items-start gap-2 rounded-lg border border-amber-400/40 bg-black/70 backdrop-blur-sm px-3 py-2 text-xs sm:text-sm text-amber-200 shadow-lg">
                <span
                  className="shrink-0 text-amber-400 leading-none pt-[1px]"
                  aria-hidden
                >
                  ⚠
                </span>
                <span className="min-w-0 leading-snug whitespace-normal break-words line-clamp-3">
                  {current.mediaFile?.captionPreset?.text ??
                    current.mediaFile?.caption}
                </span>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/15 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
            <ZoomIn className="h-4 w-4" />
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-sm px-4 py-2 text-xs text-white/70">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="hover:text-cyan transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                {selectedIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="hover:text-cyan transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 backdrop-blur-md"
          onClick={() => onZoomChange(false)}
        >
          <button
            type="button"
            onClick={() => onZoomChange(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full border border-white/15 bg-black/40 flex items-center justify-center text-white/70 hover:border-cyan hover:text-cyan z-10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-white/15 bg-black/40 flex items-center justify-center text-white/70 hover:border-cyan hover:text-cyan z-10 transition-colors"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-white/15 bg-black/40 flex items-center justify-center text-white/70 hover:border-cyan hover:text-cyan z-10 transition-colors"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <ZoomableImage
            key={`zoom-${selectedIndex}`}
            src={getZoomUrl(current)}
            alt={getAlt(current)}
          />

          {(current.mediaFile?.captionPreset?.text ||
            current.mediaFile?.caption) && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 max-w-[min(92vw,560px)] pointer-events-none z-20">
              <div className="inline-flex items-start gap-2 rounded-lg border border-amber-400/50 bg-black/80 backdrop-blur-sm px-4 py-2 text-sm text-amber-200 shadow-lg">
                <span
                  className="text-amber-400 leading-none pt-[2px]"
                  aria-hidden
                >
                  ⚠
                </span>
                <span className="leading-snug">
                  {current.mediaFile?.captionPreset?.text ??
                    current.mediaFile?.caption}
                </span>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 text-sm text-white/50">
            {images.length > 1 && (
              <span>
                {selectedIndex + 1} / {images.length}
              </span>
            )}
            <span className="text-white/30">Vuốt để phóng to</span>
          </div>
        </div>
      )}
    </>
  );
}
