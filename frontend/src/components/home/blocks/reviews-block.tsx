import Link from "next/link";
import { Star } from "lucide-react";
import type {
  AggregatedHighlightedReview,
  ReviewsData,
} from "@/lib/home-blocks";
import { SectionHead } from "./_section-head";

interface Props {
  data: ReviewsData;
  reviews: AggregatedHighlightedReview[];
}

const BORDER_THEMES = [
  "rgba(184,41,255,0.55)",
  "rgba(0,240,255,0.55)",
  "rgba(184,41,255,0.55)",
];

const AVATAR_GRADIENTS = [
  "var(--grad-cta)",
  "linear-gradient(135deg, var(--color-cyan), var(--color-purple))",
  "linear-gradient(135deg, var(--color-purple), var(--color-magenta))",
];

export function ReviewsBlock({ data, reviews }: Props) {
  const items = reviews.slice(0, data.limit);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <SectionHead eyebrow={data.eyebrow} title={data.title} />
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((review, idx) => {
          const borderColor = BORDER_THEMES[idx % BORDER_THEMES.length];
          const avatarGradient =
            AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
          const author =
            review.displayName ?? review.authorName ?? "Khách hàng";
          const initial = author.charAt(0).toUpperCase();
          return (
            <Link
              key={review.id}
              href={`/p/${review.product.slug}`}
              className="group relative block rounded-2xl border p-7 transition hover:-translate-y-px"
              style={{
                borderStyle: "dashed",
                borderColor,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5"
                    fill={i < review.rating ? "#ffd166" : "transparent"}
                    stroke={
                      i < review.rating ? "#ffd166" : "rgba(255,255,255,0.2)"
                    }
                    strokeWidth={1.5}
                  />
                ))}
              </div>
              {review.comment && (
                <p className="mb-5 line-clamp-4 font-sans text-sm italic leading-relaxed text-white/72">
                  &ldquo;{review.comment}&rdquo;
                </p>
              )}
              <div className="flex items-center gap-3">
                <div
                  className="grid size-9 place-items-center rounded-full font-display text-sm font-bold text-white"
                  style={{ background: avatarGradient }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xs font-bold tracking-[0.04em] text-white">
                    {author}
                  </div>
                  <div className="truncate font-mono text-[10px] text-white/55">
                    Đánh giá · {review.product.name}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
