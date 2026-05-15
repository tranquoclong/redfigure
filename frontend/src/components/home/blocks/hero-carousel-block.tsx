"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { AggregatedBanner, HeroCarouselData } from "@/lib/home-blocks";
import { AuroraText } from "@/components/ui/aurora-text";

interface Props {
  data: HeroCarouselData;
  banners: AggregatedBanner[];
}

const DEFAULT_AUTOPLAY = 6000;

export function HeroCarouselBlock({ data, banners }: Props) {
  const slides = banners.filter((b) => b.title.trim().length > 0);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const autoplayMs = data.autoplayMs ?? DEFAULT_AUTOPLAY;

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, autoplayMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, paused, autoplayMs]);

  if (slides.length === 0) {
    return (
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-purple/40 bg-white/[0.02] p-12 text-center backdrop-blur-sm">
          <p className="font-display text-sm uppercase tracking-[0.1em] text-white/55">
            Chưa có banner
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-[1400px] px-4 pt-4 pb-8 sm:px-6 sm:pt-6 sm:pb-10 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] backdrop-blur-sm">
        {slides.map((slide, i) => (
          <HeroSlide key={slide.id} slide={slide} isActive={i === idx} />
        ))}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Slide anterior"
              onClick={() =>
                setIdx((i) => (i - 1 + slides.length) % slides.length)
              }
              className="absolute left-4 top-1/2 -translate-y-1/2 hidden size-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-2xl text-white/72 transition hover:border-cyan/55 hover:text-cyan md:flex"
              style={{ boxShadow: "var(--glow-purple-sm)" }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Próximo slide"
              onClick={() => setIdx((i) => (i + 1) % slides.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 hidden size-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-2xl text-white/72 transition hover:border-cyan/55 hover:text-cyan md:flex"
              style={{ boxShadow: "var(--glow-purple-sm)" }}
            >
              ›
            </button>
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className="h-1 rounded-full bg-white/25 transition-all"
                  style={{
                    width: i === idx ? 56 : 28,
                    background:
                      i === idx ? "var(--grad-cta)" : "rgba(255,255,255,0.25)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function HeroSlide({
  slide,
  isActive,
}: {
  slide: AggregatedBanner;
  isActive: boolean;
}) {
  return (
    <div
      data-active={isActive}
      className="transition-opacity duration-[600ms] data-[active=false]:absolute data-[active=false]:inset-0 data-[active=false]:opacity-0 data-[active=false]:pointer-events-none data-[active=true]:relative data-[active=true]:opacity-100"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden border-b border-purple/30 lg:hidden"
        style={{ background: "linear-gradient(180deg, #160830, #0a0220)" }}
      >
        {slide.imageUrl && (
          <Image
            src={slide.imageUrl}
            alt={slide.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover opacity-55"
            priority
          />
        )}

        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 30%, rgba(6,1,15,0.85) 70%, rgba(6,1,15,0.95) 100%)",
          }}
        />

        {slide.eyebrow && (
          <div className="absolute left-4 right-4 top-4">
            <span className="inline-block rounded-full border border-purple/40 bg-purple/[0.14] px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-magenta">
              {slide.eyebrow}
            </span>
          </div>
        )}

        <div className="absolute inset-x-5 bottom-12">
          <h1
            className="mb-2.5 font-display text-[32px] font-black leading-[0.95] tracking-[0.005em] text-white"
            style={{
              textShadow:
                "-2px 0 var(--color-magenta), 2px 0 var(--color-cyan)",
            }}
          >
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="mb-3.5 text-xs leading-relaxed text-white/72">
              {slide.subtitle}
            </p>
          )}
          {(slide.primaryCtaLabel || slide.secondaryCtaLabel) && (
            <div className="flex flex-wrap gap-2.5">
              {slide.primaryCtaLabel && slide.primaryCtaHref && (
                <Link
                  href={slide.primaryCtaHref}
                  className="inline-flex rounded-full px-4 py-3 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-110"
                  style={{
                    background: "var(--grad-cta)",
                    boxShadow: "var(--glow-purple)",
                  }}
                >
                  {slide.primaryCtaLabel} →
                </Link>
              )}
              {slide.secondaryCtaLabel && slide.secondaryCtaHref && (
                <Link
                  href={slide.secondaryCtaHref}
                  className="inline-flex rounded-full border border-cyan/55 bg-cyan/[0.04] px-4 py-3 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-cyan transition hover:bg-cyan/[0.1]"
                >
                  {slide.secondaryCtaLabel} ▸
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden gap-8 p-10 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          {slide.eyebrow && (
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-xs text-cyan">
                {slide.eyebrow}
              </span>
              <span
                aria-hidden
                className="h-px w-12"
                style={{ background: "var(--grad-rule)" }}
              />
            </div>
          )}
          <h1 className="font-display text-[60px] font-black uppercase tracking-[0.02em] leading-none text-white">
            <AuroraText>{slide.title}</AuroraText>
          </h1>
          {slide.subtitle && (
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/72">
              {slide.subtitle}
            </p>
          )}
          {(slide.primaryCtaLabel || slide.secondaryCtaLabel) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {slide.primaryCtaLabel && slide.primaryCtaHref && (
                <Link
                  href={slide.primaryCtaHref}
                  className="inline-flex rounded-md px-7 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-110 hover:-translate-y-px"
                  style={{
                    background: "var(--grad-cta)",
                    boxShadow: "var(--glow-purple)",
                  }}
                >
                  {slide.primaryCtaLabel}
                </Link>
              )}
              {slide.secondaryCtaLabel && slide.secondaryCtaHref && (
                <Link
                  href={slide.secondaryCtaHref}
                  className="inline-flex rounded-md border border-cyan/55 bg-cyan/[0.04] px-7 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-cyan transition hover:bg-cyan/[0.1]"
                  style={{ boxShadow: "var(--glow-cyan-sm)" }}
                >
                  {slide.secondaryCtaLabel} ▸
                </Link>
              )}
            </div>
          )}
        </div>
        {slide.imageUrl && (
          <div
            className="relative aspect-[5/5] overflow-hidden rounded-2xl border border-white/10"
            style={{ background: "linear-gradient(180deg, #160830, #0a0220)" }}
          >
            <Image
              src={slide.imageUrl}
              alt={slide.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent 0 3px, rgba(255,255,255,0.04) 3px 4px)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
