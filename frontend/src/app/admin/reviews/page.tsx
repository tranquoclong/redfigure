"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star, Check, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { extractError } from "@/lib/extract-error";
import { revalidateHomeBlocks } from "../layout/_actions";

interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  displayName: string | null;
  isApproved: boolean;
  isHighlightedOnHome: boolean;
  createdAt: string;
  user: { name: string | null; email: string };
  product: { name: string; slug: string };
}

export default function AdminReviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [error, setError] = useState("");

  const reviewsQuery = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => {
      const response = await api.get<{ data: AdminReview[] }>("/reviews/admin");
      return response.data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/reviews/${id}/approve`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "reviews"] }),
    onError: (err) => setError(extractError(err)),
  });

  const highlightMutation = useMutation({
    mutationFn: async ({
      id,
      isHighlighted,
    }: {
      id: string;
      isHighlighted: boolean;
    }) => {
      await api.patch(`/reviews/${id}/highlight`, { isHighlighted });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      await revalidateHomeBlocks();
    },
    onError: (err) => setError(extractError(err)),
  });

  const reviews = reviewsQuery.data ?? [];
  const filtered = reviews.filter((r) => {
    if (filter === "pending") return !r.isApproved;
    if (filter === "approved") return r.isApproved;
    return true;
  });
  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => !r.isApproved).length,
    approved: reviews.filter((r) => r.isApproved).length,
    highlighted: reviews.filter((r) => r.isHighlightedOnHome).length,
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white">
          Đánh giá
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Duyệt đánh giá mới (tạo mã giảm giá thưởng tự động) và đánh dấu tối đa
          12 để hiển thị trong khối &ldquo;Đánh giá&rdquo; trên trang chủ.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-magenta/40 bg-magenta/10 p-3 text-sm text-magenta">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Tất cả ({counts.all})
        </FilterButton>
        <FilterButton
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
        >
          Chờ duyệt ({counts.pending})
        </FilterButton>
        <FilterButton
          active={filter === "approved"}
          onClick={() => setFilter("approved")}
        >
          Đã duyệt ({counts.approved})
        </FilterButton>
        <span className="ml-auto self-center font-mono text-xs text-cyan">
          Đang hiển thị trang chủ: {counts.highlighted}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{filtered.length} kết quả</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-white/55">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/55">
              Không có đánh giá nào trong bộ lọc này.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  onApprove={() => approveMutation.mutate(r.id)}
                  onToggleHighlight={(v) =>
                    highlightMutation.mutate({ id: r.id, isHighlighted: v })
                  }
                  isApproving={approveMutation.isPending}
                  isToggling={highlightMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 font-display text-xs uppercase tracking-wider transition-colors ${
        active
          ? "border-cyan/55 bg-cyan/10 text-cyan"
          : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ReviewRow({
  review,
  onApprove,
  onToggleHighlight,
  isApproving,
  isToggling,
}: {
  review: AdminReview;
  onApprove: () => void;
  onToggleHighlight: (value: boolean) => void;
  isApproving: boolean;
  isToggling: boolean;
}) {
  const author = review.displayName ?? review.user.name ?? review.user.email;
  return (
    <div
      className={`flex flex-col gap-3 rounded-md border p-4 md:flex-row md:items-start ${
        review.isApproved
          ? "border-white/8 bg-black/30"
          : "border-amber-500/30 bg-amber-500/[0.04]"
      }`}
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className="size-3.5"
            fill={i < review.rating ? "#ffd166" : "transparent"}
            stroke={i < review.rating ? "#ffd166" : "rgba(255,255,255,0.25)"}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        {review.comment && (
          <p className="text-sm italic text-white/72 line-clamp-2">
            &ldquo;{review.comment}&rdquo;
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/55">
          <span className="text-white/72">{author}</span>
          <span>·</span>
          <Link
            href={`/p/${review.product.slug}`}
            className="inline-flex items-center gap-1 text-cyan hover:text-white"
            target="_blank"
          >
            {review.product.name}
            <ExternalLink className="size-3" />
          </Link>
          <span>·</span>
          <span>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 md:flex-col md:items-end">
        {review.isApproved ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-white/55">
              Đang hiển thị trang chủ
            </span>
            <Switch
              checked={review.isHighlightedOnHome}
              onCheckedChange={onToggleHighlight}
              disabled={isToggling}
            />
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onApprove}
            disabled={isApproving}
          >
            {isApproving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Duyệt
          </Button>
        )}
      </div>
    </div>
  );
}
