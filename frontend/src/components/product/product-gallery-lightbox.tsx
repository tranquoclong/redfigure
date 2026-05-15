"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
  caption?: string | null;
}

export interface ProductGalleryLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const SCROLL_STEP = 0.25;

export function ProductGalleryLightbox(props: ProductGalleryLightboxProps) {
  if (!props.open) return null;
  return <LightboxBody {...props} />;
}

function LightboxBody({
  images,
  initialIndex,
  onClose,
}: ProductGalleryLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const dragMoved = useRef(false);

  const total = images.length;
  const current = images[index];

  const resetView = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + total) % total);
        resetView();
      } else if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % total);
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose, resetView]);

  if (!current || typeof document === "undefined") return null;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCROLL_STEP : SCROLL_STEP;
    setScale((s) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta));

      if (next <= 1) {
        setPos({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragMoved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    setPos({
      x: dragStart.current.posX + dx,
      y: dragStart.current.posY + dy,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const goPrev = () => {
    setIndex((i) => (i - 1 + total) % total);
    resetView();
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % total);
    resetView();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hình ảnh xem toàn màn hình"
      className="fixed inset-0 z-[9999] bg-ink/95 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {current.caption && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 flex max-w-[80vw] -translate-x-1/2 items-center gap-2 rounded-md border border-gold/45 bg-ink/90 px-4 py-2 font-display text-[12px] uppercase tracking-wider text-gold backdrop-blur">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="truncate">{current.caption}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-6 top-6 z-10 flex size-10 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
      >
        <X className="size-6" />
      </button>

      <div
        className={cn(
          "flex h-full w-full select-none items-center justify-center",
          scale > 1
            ? dragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-zoom-in",
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (dragMoved.current) {
            dragMoved.current = false;
            return;
          }

          if (e.target === e.currentTarget) {
            onClose();
            return;
          }

          setScale((s) => (s === 1 ? 2 : 1));
          if (scale > 1) setPos({ x: 0, y: 0 });
        }}
      >
        <div
          className="relative max-h-[85vh] max-w-[85vw] transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          }}
        >
          <Image
            src={current.src}
            alt={current.alt}
            width={1600}
            height={1600}
            sizes="85vw"
            className="pointer-events-none max-h-[85vh] w-auto object-contain"
            unoptimized
            priority
          />

          {scale > 1.01 && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-ink/85 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-cyan backdrop-blur">
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Imagem anterior"
            className="absolute left-4 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-7" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Hình ảnh tiếp theo"
            className="absolute right-4 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="size-7" />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 font-mono text-[12px] text-white/65">
        <span className="text-white/85">
          {index + 1} / {total}
        </span>
        <span className="text-white/40">·</span>
        <span>Scroll để phóng to</span>
      </div>
    </div>,
    document.body,
  );
}
