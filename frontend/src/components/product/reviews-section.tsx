"use client";

import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/constants";

interface ReviewsSectionProps {
  productId: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  images: string | null;
  createdAt: string;
  user: { name: string | null };
}

const ALLOWED_REVIEW_IMAGE_HOSTS = new Set(["s3-hcm-r2.s3cloud.vn"]);
const ALLOWED_HOST_SUFFIXES = [".r2.cloudflarestorage.com"];

function isAllowedReviewImageUrl(u: unknown): u is string {
  if (typeof u !== "string") return false;
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (ALLOWED_REVIEW_IMAGE_HOSTS.has(url.hostname)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

interface ReviewsResponse {
  reviews: Review[];
  average: number;
  count: number;
  distribution?: Record<"5" | "4" | "3" | "2" | "1", number>;
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}/reviews`);
      return data.data ?? data;
    },
  });

  if (isLoading) return null;

  const reviews = data?.reviews ?? [];
  const average = data?.average ?? 0;
  const count = data?.count ?? 0;
  const distribution = data?.distribution ?? {
    "5": 0,
    "4": 0,
    "3": 0,
    "2": 0,
    "1": 0,
  };

  if (count === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
        Chưa có đánh giá cho sản phẩm này. Hãy là người đầu tiên mua và đánh
        giá!
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]" id="danh-gia">
      <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div>
          <div className="font-display text-5xl font-extrabold leading-none text-white">
            {average.toFixed(1)}
          </div>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={
                  n <= Math.round(average)
                    ? "size-4 fill-gold text-gold"
                    : "size-4 text-white/20"
                }
              />
            ))}
          </div>
          <div className="mt-1 font-mono text-xs uppercase tracking-wider text-white/55">
            {count} {count === 1 ? "đánh giá" : "đánh giá"}
          </div>
        </div>

        <div className="space-y-1.5 pt-3">
          {(["5", "4", "3", "2", "1"] as const).map((key) => {
            const value = distribution[key];
            const pct = count > 0 ? (value / count) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3 text-xs">
                <span className="w-3 font-mono text-white/55">{key}</span>
                <Star className="size-3 fill-gold text-gold" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full bg-lime transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-white/55">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        {reviews.map((review) => {
          let images: string[] = [];
          try {
            const parsed = review.images ? JSON.parse(review.images) : [];
            if (Array.isArray(parsed)) {
              images = parsed.filter(isAllowedReviewImageUrl);
            }
          } catch {
            images = [];
          }

          return (
            <article
              key={review.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
            >
              <header className="mb-3 flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= review.rating
                          ? "size-3.5 fill-gold text-gold"
                          : "size-3.5 text-white/20"
                      }
                    />
                  ))}
                </div>
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-white">
                  {review.user.name ?? "Ẩn danh"}
                </span>
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-white/45">
                  {formatDate(review.createdAt)}
                </span>
              </header>

              {review.comment && (
                <p className="text-sm leading-relaxed text-white/75">
                  {review.comment}
                </p>
              )}

              {images.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Ảnh ${i + 1}`}
                      className="size-20 rounded-md border border-white/10 object-cover"
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
