"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type InviteData = {
  invite: { id: string; token: string };
  order: {
    id: string;
    number: string;
    items: Array<{
      id: string;
      productId: string;
      product: {
        id: string;
        name: string;
        slug: string;
        images?: Array<{ mediaFile?: { card?: string } | null }> | null;
      };
      variationId: string | null;
      variation: { id: string; name: string } | null;
    }>;
  };
  user: { id: string; name: string | null; email: string };
};

interface Props {
  data: InviteData;
  token: string;
}

function buildDisplayNameOptions(name: string | null): string[] {
  if (!name) return ["Ẩn danh"];
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["Ẩn danh"];
  const full = parts.join(" ");
  const initials = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  const first = parts[0];
  const options = new Set<string>([full, initials, first, "Ẩn danh"]);
  return Array.from(options);
}

function buildReviewItems(items: InviteData["order"]["items"]) {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = `${it.productId}-${it.variationId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ReviewForm({ data, token }: Props) {
  const router = useRouter();
  const reviewItems = useMemo(
    () => buildReviewItems(data.order.items),
    [data.order.items],
  );
  const displayOptions = useMemo(
    () => buildDisplayNameOptions(data.user.name),
    [data.user.name],
  );

  const [siteRating, setSiteRating] = useState(0);
  const [siteComment, setSiteComment] = useState("");
  const [productReviews, setProductReviews] = useState<
    Record<string, { rating: number; comment: string; mediaFileIds: string[] }>
  >(() =>
    Object.fromEntries(
      reviewItems.map((it) => [
        it.productId,
        { rating: 0, comment: "", mediaFileIds: [] },
      ]),
    ),
  );
  const [displayName, setDisplayName] = useState<string>(
    displayOptions[0] ?? "Ẩn danh",
  );
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allProductsRated = reviewItems.every(
    (it) => productReviews[it.productId]?.rating >= 1,
  );
  const canSubmit = siteRating >= 1 && allProductsRated && !submitting;

  async function handlePhotoUpload(productId: string, files: FileList | null) {
    if (!files?.length) return;
    setUploadingFor(productId);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files)
        .slice(0, 5)
        .forEach((f) => fd.append("files", f));
      const { data: res } = await api.post(
        `/review-invites/${token}/photos`,
        fd,
        {
          timeout: 120000,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      const uploaded: Array<{ id: string }> = res.data ?? [];
      setProductReviews((prev) => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          mediaFileIds: [
            ...prev[productId].mediaFileIds,
            ...uploaded.map((u) => u.id),
          ].slice(0, 5),
        },
      }));
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Không thể tải ảnh";
      setError(msg);
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/review-invites/${token}/submit`, {
        site: {
          rating: siteRating,
          comment: siteComment.trim() || undefined,
        },
        products: reviewItems.map((it) => ({
          productId: it.productId,
          rating: productReviews[it.productId].rating,
          comment: productReviews[it.productId].comment.trim() || undefined,
          mediaFileIds: productReviews[it.productId].mediaFileIds.length
            ? productReviews[it.productId].mediaFileIds
            : undefined,
        })),
        displayName,
      });
      router.push("/my-account?review=success");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ??
        "Không thể gửi đánh giá. Vui lòng thử lại.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="mb-2 text-3xl font-bold text-white [font-family:var(--font-orbitron)]">
          Đánh giá sản phẩm
        </h1>
        <p className="text-sm text-white/60">
          Đánh giá đơn hàng <strong>#{data.order.number}</strong>
          giúp chúng tôi cải thiện.
        </p>
        <p className="mt-2 text-xs text-cyan/70">* Bắt buộc</p>
      </header>

      <Card title="Đánh giá sản phẩm">
        <Field label="Đánh giá tổng thể website, dịch vụ giao hàng và hỗ trợ khách hàng? *">
          <RatingStars value={siteRating} onChange={setSiteRating} />
        </Field>
        <Field label="Bình luận">
          <TextArea
            value={siteComment}
            onChange={setSiteComment}
            placeholder="Bình luận"
          />
        </Field>
      </Card>

      {reviewItems.map((item) => {
        const state = productReviews[item.productId];
        const img = item.product.images?.[0]?.mediaFile?.card ?? null;
        return (
          <Card key={item.productId} title={item.product.name}>
            {img && (
              <div className="relative mx-auto mb-4 h-40 w-40 overflow-hidden rounded-lg border border-purple/25">
                <Image
                  src={img}
                  alt={item.product.name}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
            )}
            {item.variation && (
              <p className="mb-3 text-center text-xs text-white/60">
                Biến thể: {item.variation.name}
              </p>
            )}
            <Field label="Đánh giá *">
              <RatingStars
                value={state.rating}
                onChange={(v) =>
                  setProductReviews((prev) => ({
                    ...prev,
                    [item.productId]: { ...prev[item.productId], rating: v },
                  }))
                }
              />
            </Field>
            <Field label="Bình luận">
              <TextArea
                value={state.comment}
                onChange={(v) =>
                  setProductReviews((prev) => ({
                    ...prev,
                    [item.productId]: { ...prev[item.productId], comment: v },
                  }))
                }
                placeholder="Bình luận"
              />
            </Field>
            <Field label={`Ảnh (tùy chọn, tối đa 5)`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={
                  uploadingFor === item.productId ||
                  state.mediaFileIds.length >= 5
                }
                onChange={(e) =>
                  handlePhotoUpload(item.productId, e.target.files)
                }
                className="block w-full text-sm text-white/70
                  file:mr-3 file:rounded-md file:border file:border-purple/30
                  file:bg-ink-soft file:px-3 file:py-1.5 file:text-xs
                  file:font-medium file:text-cyan file:transition
                  hover:file:bg-purple/20"
              />
              {state.mediaFileIds.length > 0 && (
                <p className="mt-1 text-xs text-cyan/70">
                  {state.mediaFileIds.length} ảnh đã tải lên
                </p>
              )}
              {uploadingFor === item.productId && (
                <p className="mt-1 text-xs text-white/50">Đang tải…</p>
              )}
            </Field>
          </Card>
        );
      })}

      <Card title="Tên hiển thị">
        <p className="mb-3 text-sm text-white/70">
          Tên hiển thị trong các đánh giá
        </p>
        <div className="flex flex-wrap gap-2">
          {displayOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDisplayName(opt)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition",
                displayName === opt
                  ? "border-cyan bg-cyan/20 text-cyan"
                  : "border-white/15 text-white/70 hover:border-cyan/50",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-magenta/40 bg-magenta/10 px-4 py-3 text-sm text-magenta">
          {error}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button
          variant="neon"
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? "Đang gửi…" : "GỬI ĐÁNH GIÁ"}
        </Button>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-purple/25 bg-gradient-to-b from-[#160830] to-[#0a0220]">
      <header className="border-b border-purple/25 bg-purple/15 px-4 py-3">
        <h2 className="text-center text-sm font-semibold text-cyan [font-family:var(--font-orbitron)]">
          {title}
        </h2>
      </header>
      <div className="space-y-4 px-4 py-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-white">
        {label}
      </label>
      {children}
    </div>
  );
}

function RatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-1 transition hover:scale-110"
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-8 w-8 transition",
              n <= value
                ? "fill-cyan text-cyan"
                : "text-white/30 hover:text-cyan/70",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      maxLength={2000}
      className="w-full rounded-lg border border-purple/25 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan/60 focus:outline-none"
    />
  );
}
