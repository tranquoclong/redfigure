"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, Heart, MapPin, Truck } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";
import {
  ORDER_STEPS,
  getOrderStepIndex,
  getOrderStatusInfo,
  isOrderInProgress,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  productName?: string;
  quantity: number;
  product?: {
    name?: string;
    images?: Array<{
      isMain?: boolean;
      url?: string;
      mediaFile?: { card?: string };
    }>;
  };
}

interface Order {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  items?: OrderItem[];
}

interface ApiResponse<T> {
  data: T;
  meta?: { total: number };
}

interface UserMe {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string;
}

function getInitial(name?: string | null): string {
  if (!name) return "?";
  const first = name.trim().charAt(0).toUpperCase();
  return first || "?";
}

function formatMonthYear(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function summarizeItems(items?: OrderItem[]): string {
  if (!items || items.length === 0) return "đặt hàng";
  const first = items[0].product?.name ?? items[0].productName ?? "Sản phẩm";
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} Sản phẩm`;
}

function firstItemImage(items?: OrderItem[]): string | null {
  if (!items?.length) return null;
  const imgs = items[0].product?.images ?? [];
  const main = imgs.find((i) => i.isMain) ?? imgs[0];
  return main?.mediaFile?.card ?? main?.url ?? null;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: typeof Package;
}) {
  return (
    <div className="rounded-2xl border border-purple/25 bg-white/[0.02] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wider text-cyan uppercase">
          {label}
        </p>
        <Icon className="h-4 w-4 text-white/40" />
      </div>
      <p className="mt-2 text-3xl text-white [font-family:var(--font-orbitron)]">
        {value.toLocaleString("vi-VN")}
      </p>
      {hint && <p className="mt-1 text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}

function OrderStepper({ status }: { status: string }) {
  const currentIndex = getOrderStepIndex(status);

  return (
    <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
      {ORDER_STEPS.map((step, idx) => {
        const isDone = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <div key={step.key}>
            <div
              className={cn(
                "mx-auto grid h-9 w-9 place-items-center rounded-full border text-xs",
                isCurrent &&
                  "border-transparent bg-gradient-to-br from-purple to-magenta text-white font-bold animate-pulse shadow-[0_0_18px_rgba(184,41,255,0.55)]",
                isDone && "border-cyan bg-cyan/20 text-cyan",
                !isCurrent && !isDone && "border-white/15 text-white/30",
              )}
            >
              {isDone ? "✓" : idx + 1}
            </div>
            <div
              className={cn(
                "mt-2 tracking-wider text-[10px]",
                isCurrent && "text-white",
                isDone && "text-cyan",
                !isCurrent && !isDone && "text-white/30",
              )}
            >
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CurrentOrderCard({ order }: { order: Order }) {
  const image = firstItemImage(order.items);
  const summary = summarizeItems(order.items);
  const info = getOrderStatusInfo(order.status);

  return (
    <div className="rounded-2xl border border-purple/25 bg-white/[0.02] p-6 backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] tracking-wider text-white/60 uppercase">
          Đơn hàng đang xử lý
        </p>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[10px] [font-family:var(--font-orbitron)] tracking-wider uppercase",
            info.tone === "ok" && "border-cyan/55 bg-cyan/10 text-cyan",
            info.tone === "warn" &&
              "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
            info.tone === "danger" &&
              "border-magenta/55 bg-magenta/10 text-magenta",
          )}
        >
          {info.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="h-20 w-20 shrink-0 rounded-xl bg-cover bg-center"
          style={
            image
              ? { backgroundImage: `url(${image})` }
              : {
                  background:
                    "radial-gradient(circle at 50% 30%, rgba(255,0,122,0.5), rgba(26,8,51,1))",
                }
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-cyan font-mono">#{order.number}</p>
          <p className="text-lg text-white truncate">{summary}</p>
          <p className="text-xs text-white/50 mt-0.5">
            Đặt hàng lúc {formatShortDate(order.createdAt)} ·{" "}
            {formatCurrency(order.total)}
          </p>
        </div>
        <Link
          href={`/my-account/orders/${order.id}`}
          className="hidden md:inline-flex items-center gap-2 rounded-full border border-cyan/55 bg-cyan/5 px-5 py-2 text-[11px] text-cyan [font-family:var(--font-orbitron)] tracking-wider hover:bg-cyan/10"
        >
          <Truck className="h-3.5 w-3.5" />
          XEM CHI TIẾT
        </Link>
      </div>

      <div className="mt-6">
        <OrderStepper status={order.status} />
      </div>
    </div>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  const image = firstItemImage(order.items);
  const summary = summarizeItems(order.items);
  const info = getOrderStatusInfo(order.status);

  return (
    <Link
      href={`/my-account/orders/${order.id}`}
      className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-cyan/40 hover:bg-white/[0.04]"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
        style={
          image
            ? { backgroundImage: `url(${image})` }
            : {
                background:
                  "radial-gradient(circle at 50% 30%, rgba(184,41,255,0.45), rgba(8,2,28,1))",
              }
        }
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-cyan font-mono">#{order.number}</p>
        <p className="text-sm text-white truncate">{summary}</p>
      </div>
      <div className="hidden sm:block text-xs text-white/40">
        {formatShortDate(order.createdAt)}
      </div>
      <div className="text-right">
        <p className="text-sm text-white [font-family:var(--font-orbitron)]">
          {formatCurrency(order.total)}
        </p>
        <p
          className={cn(
            "text-[10px] mt-0.5",
            info.tone === "ok" && "text-cyan",
            info.tone === "warn" && "text-yellow-400",
            info.tone === "danger" && "text-magenta",
          )}
        >
          {info.label.toLowerCase()}
        </p>
      </div>
    </Link>
  );
}

export default function AccountDashboard() {
  const user = useAuthStore((s) => s.user);

  const ordersQuery = useQuery({
    queryKey: ["my-orders-dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Order[]>>("/orders", {
        params: { perPage: 10 },
      });
      return {
        items: data.data,
        total: data.meta?.total ?? data.data.length,
      };
    },
  });

  const wishlistQuery = useQuery({
    queryKey: ["my-wishlist-dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<unknown[]>>("/wishlist");
      return data.data?.length ?? 0;
    },
  });

  const addressesQuery = useQuery({
    queryKey: ["my-addresses-dashboard"],
    queryFn: async () => {
      try {
        const { data } = await api.get<ApiResponse<unknown[]>>("/addresses");
        return data.data?.length ?? 0;
      } catch {
        return 0;
      }
    },
  });

  const orders = ordersQuery.data?.items ?? [];
  const totalOrders = ordersQuery.data?.total ?? 0;
  const inProgressOrders = orders.filter((o) => isOrderInProgress(o.status));
  const currentOrder = inProgressOrders[0] ?? null;
  const recentOrders = orders.slice(0, 5);

  const userCreatedAt = (user as unknown as UserMe | null)?.createdAt;

  return (
    <div className="space-y-6">
      <div className="text-xs text-white/50">
        Trang chủ · <span className="text-cyan">Tài khoản</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple to-cyan text-2xl text-white [font-family:var(--font-orbitron)]">
          {getInitial(user?.name)}
        </div>
        <div>
          <h1 className="text-3xl text-white">
            <span className="drop-shadow-[0_0_22px_rgba(0,240,255,0.7)]">
              {user?.name?.split(" ")[0] ?? "Đã đăng nhập"}
            </span>
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {userCreatedAt &&
              `Khách hàng từ ${formatMonthYear(userCreatedAt)} · `}
            {totalOrders} Đơn hàng
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Đơn hàng"
          value={totalOrders}
          hint={
            inProgressOrders.length > 0
              ? `${inProgressOrders.length} Đang xử lý`
              : "Hoàn thành"
          }
          icon={Package}
        />
        <StatCard
          label="Yêu thích"
          value={wishlistQuery.data ?? 0}
          hint="Sản phẩm"
          icon={Heart}
        />
        <StatCard
          label="Địa chỉ"
          value={addressesQuery.data ?? 0}
          hint="Địa chỉ"
          icon={MapPin}
        />
      </div>

      {currentOrder && <CurrentOrderCard order={currentOrder} />}

      {recentOrders.length > 0 && (
        <div className="rounded-2xl border border-purple/25 bg-white/[0.02] p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[11px] tracking-wider text-white/60 uppercase">
              Đơn hàng gần đây
            </p>
            <Link
              href="/my-account/orders"
              className="text-xs text-cyan hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <RecentOrderRow key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {!ordersQuery.isLoading && orders.length === 0 && (
        <div className="rounded-2xl border border-purple/25 bg-white/[0.02] p-12 text-center backdrop-blur-sm">
          <Package className="mx-auto h-12 w-12 text-white/20" />
          <p className="mt-4 text-white/60">Bạn chưa có đơn hàng.</p>
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-purple to-magenta px-6 py-2.5 text-xs text-white [font-family:var(--font-orbitron)] tracking-wider shadow-[0_0_22px_rgba(184,41,255,0.45)]"
          >
            Khám phá ngay
          </Link>
        </div>
      )}
    </div>
  );
}
