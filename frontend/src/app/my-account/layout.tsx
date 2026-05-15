"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  Heart,
  Eye,
  MapPin,
  Settings,
  LogOut,
  Award,
  FileText,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { TopBar } from "@/components/layout/top-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  defaultTopBar,
  menuItems,
  footerColumns,
  socialLinks,
  footerLegal,
} from "@/lib/site-content";

import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Package;
  exact?: boolean;
  countKey?: "orders" | "wishlist" | "quotes";
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/my-account",
    label: "Trang cá nhân",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/my-account/orders",
    label: "Đơn hàng của tôi",
    icon: Package,
    countKey: "orders",
  },
  {
    href: "/my-account/quotes",
    label: "Báo giá",
    icon: FileText,
    countKey: "quotes",
  },
  {
    href: "/my-account/wishlist",
    label: "Danh sách yêu thích",
    icon: Heart,
    countKey: "wishlist",
  },
  {
    href: "/my-account/recently-viewed",
    label: "Đã xem gần đây",
    icon: Eye,
  },
  { href: "/my-account/affiliate", label: "Người bán liên kết", icon: Award },
  { href: "/my-account/addresses", label: "Địa chỉ giao hàng", icon: MapPin },
  { href: "/my-account/profile", label: "Thông tin tài khoản", icon: Settings },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isHydrated, logout } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isHydrated, router, pathname]);

  const ordersQuery = useQuery({
    queryKey: ["my-orders-count"],
    queryFn: async () => {
      const { data } = await api.get<{
        meta?: { total?: number };
        data?: unknown[];
      }>("/orders", { params: { perPage: 1 } });
      return data.meta?.total ?? data.data?.length ?? 0;
    },
    enabled: isHydrated && isAuthenticated,
  });

  const wishlistQuery = useQuery({
    queryKey: ["my-wishlist-count"],
    queryFn: async () => {
      const { data } = await api.get<{ data?: unknown[] }>("/wishlist");
      return data.data?.length ?? 0;
    },
    enabled: isHydrated && isAuthenticated,
  });

  const quotesQuery = useQuery({
    queryKey: ["my-quotes-count"],
    queryFn: async () => {
      const { data } = await api.get<{
        meta?: { total?: number };
        data?: unknown[];
      }>("/custom-quotes/me", { params: { perPage: 1 } });
      return data.meta?.total ?? data.data?.length ?? 0;
    },
    enabled: isHydrated && isAuthenticated,
  });

  const counts = {
    orders: ordersQuery.data ?? 0,
    wishlist: wishlistQuery.data ?? 0,
    quotes: quotesQuery.data ?? 0,
  };

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-white/60">Đang tải...</p>
      </div>
    );
  }

  return (
    <>
      <TopBar messages={defaultTopBar.messages} />
      <Header menu={menuItems} />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 lg:col-span-3">
            <nav className="rounded-2xl border border-purple/25 bg-white/[0.02] p-3 lg:sticky lg:top-24 backdrop-blur-sm">
              <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {NAV_ITEMS.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  const count = item.countKey ? counts[item.countKey] : null;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm whitespace-nowrap transition-all",
                          isActive
                            ? "bg-gradient-to-br from-purple to-magenta text-white font-medium shadow-[0_0_18px_rgba(184,41,255,0.45)] [font-family:var(--font-orbitron)] tracking-wider text-xs uppercase"
                            : "text-white/70 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {count !== null && count > 0 && !isActive && (
                          <span className="ml-auto text-[11px] text-cyan font-mono">
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                <li className="border-t border-white/10 my-2 hidden lg:block" />
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      router.push("/");
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-magenta/80 hover:bg-white/5 hover:text-magenta transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </li>
              </ul>
            </nav>
          </aside>

          <main className="col-span-12 lg:col-span-9 min-w-0">{children}</main>
        </div>
      </div>
      <Footer
        columns={footerColumns}
        socials={socialLinks}
        legal={footerLegal}
      />
    </>
  );
}
