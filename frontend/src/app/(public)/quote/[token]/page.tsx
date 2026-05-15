"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Clock, ShoppingCart } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

type QuoteStatus =
  | "SENT"
  | "PARTIALLY_ACCEPTED"
  | "FULLY_ACCEPTED"
  | "EXPIRED"
  | "CANCELLED";

interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  maxQuantity: number;
  status: "QUOTED" | "ACCEPTED" | "CANCELLED";
  weight: number;
  width: number;
  height: number;
  length: number;
}

interface QuoteImage {
  id: string;
  mediaFile?: { thumb: string; card: string; gallery: string } | null;
  uploadedBy: "ADMIN" | "CUSTOMER";
}

interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  expiresAt: string;
  customerName: string;
  customerNotes: string | null;
  externalLinks: string[];
  items: QuoteItem[];
  images: QuoteImage[];
}

function formatCurrency(v: number): string {
  return v.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) {
    return (
      <span className="text-destructive font-medium">Hết hạn báo giá</span>
    );
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  const critical = diff < 86_400_000;
  const label =
    days > 0
      ? `${days} ngày ${hours} giờ`
      : hours > 0
        ? `${hours} giờ ${minutes} phút`
        : `${minutes} phút`;

  return (
    <span
      className={
        critical ? "text-destructive font-semibold" : "text-cyan font-semibold"
      }
    >
      {label}
    </span>
  );
}

export default function QuoteTokenPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public", "custom-quote", token],
    queryFn: async () => {
      const { data } = await api.get(`/custom-quotes/token/${token}`);
      return data.data as Quote;
    },
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: async (
      items: Array<{ quoteItemId: string; quantity: number }>,
    ) => {
      for (const item of items) {
        await api.post("/cart/items/quote", item);
      }
    },
  });

  const selectedItems = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, qty]) => qty > 0)
        .map(([quoteItemId, quantity]) => ({ quoteItemId, quantity })),
    [selected],
  );

  const selectedTotal = useMemo(() => {
    if (!data) return 0;
    return data.items.reduce((sum, item) => {
      const qty = selected[item.id] ?? 0;
      return sum + item.unitPrice * qty;
    }, 0);
  }, [selected, data]);

  async function handleAddToCart() {
    if (!data) return;
    if (!isAuthenticated || !user?.email) {
      const returnTo = encodeURIComponent(`/quote/${token}`);
      router.push(`/login?returnTo=${returnTo}`);
      return;
    }
    if (selectedItems.length === 0) {
      setFeedback({
        kind: "error",
        message: "Vui lòng chọn ít nhất 1 sản phẩm",
      });
      return;
    }

    setAdding(true);
    setFeedback(null);
    try {
      await addMutation.mutateAsync(selectedItems);
      setFeedback({
        kind: "success",
        message: "Sản phẩm được thêm vào giỏ hàng!",
      });
      setTimeout(() => router.push("/cart"), 800);
    } catch (err) {
      const message =
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } } | undefined)
            ?.error?.message) ||
        "Không thể thêm. Vui lòng thử lại.";
      setFeedback({ kind: "error", message });
    } finally {
      setAdding(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-white/60">
        Đang tải báo giá...
      </div>
    );
  }

  if (error || !data) {
    const err = error as AxiosError | null;
    const msg =
      (err?.response?.data as { error?: { message?: string } } | undefined)
        ?.error?.message ?? "Báo giá không khả dụng";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
          <h1 className="text-xl font-bold text-destructive mb-2">
            Báo giá không khả dụng
          </h1>
          <p className="text-white/70 mb-4">{msg}</p>
          <Link href="/quote">
            <Button variant="outline">Yêu cầu báo giá mới</Button>
          </Link>
        </div>
      </div>
    );
  }

  const availableItems = data.items.filter((i) => i.status === "QUOTED");
  const unavailableItems = data.items.filter((i) => i.status !== "QUOTED");
  const allFullyAccepted = data.status === "FULLY_ACCEPTED";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-white/50 mb-1">
          Báo giá
        </p>
        <h1 className="text-3xl md:text-4xl font-black [font-family:var(--font-orbitron)] text-white">
          {data.number}
        </h1>
        <p className="text-white/70 mt-2">Xin chào, {data.customerName}!</p>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-ink-soft/30 p-4 flex items-center gap-3">
        <Clock className="h-5 w-5 text-cyan shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-white/50 uppercase tracking-wider">
            Hết hạn sau
          </p>
          <Countdown expiresAt={data.expiresAt} />
        </div>
      </div>

      {allFullyAccepted && (
        <div className="mb-6 rounded-xl border border-cyan/40 bg-cyan/10 p-4 text-cyan">
          Tất cả các mặt hàng trong báo giá này đã được mua.
        </div>
      )}

      {data.customerNotes && (
        <div className="mb-6 rounded-xl border border-white/10 bg-ink-soft/20 p-4">
          <p className="text-xs uppercase tracking-wider text-white/50 mb-1">
            Yêu cầu
          </p>
          <p className="text-sm text-white/80 whitespace-pre-wrap">
            {data.customerNotes}
          </p>
        </div>
      )}

      {availableItems.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs uppercase tracking-wider text-white/60 [font-family:var(--font-orbitron)]">
            Chọn các mục muốn mua
          </h2>
          {availableItems.map((item) => {
            const qty = selected[item.id] ?? 0;
            const isSelected = qty > 0;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition ${
                  isSelected
                    ? "border-cyan/60 bg-cyan/5"
                    : "border-white/10 bg-ink-soft/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-white/60 mt-1">
                        {item.description}
                      </p>
                    )}
                    <p className="text-lg font-bold text-cyan mt-2 [font-family:var(--font-orbitron)]">
                      {formatCurrency(item.unitPrice)} ₫
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked ? 1 : 0,
                          }))
                        }
                      />
                      <span className="text-sm">Chọn</span>
                    </label>
                    {isSelected && item.maxQuantity > 1 && (
                      <input
                        type="number"
                        min={1}
                        max={item.maxQuantity}
                        value={qty}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [item.id]: Math.max(
                              1,
                              Math.min(
                                item.maxQuantity,
                                parseInt(e.target.value, 10) || 1,
                              ),
                            ),
                          }))
                        }
                        className="w-16 h-9 rounded-md border border-white/10 bg-ink-soft/50 px-2 text-sm text-white"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unavailableItems.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs uppercase tracking-wider text-white/40">
            Sản phẩm không khả dụng
          </h2>
          {unavailableItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/5 bg-ink-soft/10 p-4 opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-white/60 line-through">{item.name}</span>
                <span className="text-xs text-white/40 uppercase">
                  {item.status === "ACCEPTED" ? "Đã mua" : "Đã hủy"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.images.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-white/60 mb-3">
            Hình ảnh
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.images.map((img) => (
              <img
                key={img.id}
                src={img.mediaFile?.card ?? ""}
                alt=""
                className="w-24 h-24 object-cover rounded-md border border-white/10"
              />
            ))}
          </div>
        </div>
      )}

      {data.externalLinks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-white/60 mb-2">
            Liên kết
          </h2>
          <ul className="space-y-1">
            {data.externalLinks.map((url) => (
              <li key={url} className="text-sm">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {availableItems.length > 0 && (
        <div className="sticky bottom-4 mt-8 rounded-2xl border border-white/10 bg-ink-soft/80 backdrop-blur-md p-4 shadow-lg">
          {feedback && (
            <div
              role={feedback.kind === "error" ? "alert" : "status"}
              className={`text-sm mb-3 ${
                feedback.kind === "error" ? "text-destructive" : "text-cyan"
              }`}
            >
              {feedback.message}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">
                Sản phẩm đã chọn: {selectedItems.length}
              </p>
              <p className="text-xl font-bold text-cyan [font-family:var(--font-orbitron)]">
                {formatCurrency(selectedTotal)} ₫
              </p>
            </div>
            <Button
              variant="neon"
              size="lg"
              disabled={adding || selectedItems.length === 0}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {adding
                ? "Đang thêm..."
                : isAuthenticated
                  ? "Thêm vào giỏ hàng"
                  : "Đăng nhập để mua"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
