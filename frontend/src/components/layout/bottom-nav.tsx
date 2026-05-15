"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Heart, User, SlidersHorizontal } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { useCatalogFilterStore } from "@/store/catalog-filter-store";
import { cn } from "@/lib/utils";

interface NavTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  href: string;
}

const TABS: NavTab[] = [
  { key: "home", label: "Trang chủ", icon: Home, href: ROUTES.home },
  { key: "catalog", label: "Sản phẩm", icon: LayoutGrid, href: "/products" },
  { key: "wish", label: "Yêu thích", icon: Heart, href: ROUTES.wishlist },
  { key: "me", label: "Tài khoản", icon: User, href: ROUTES.account },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isListingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/products" || pathname === "/search") return true;
  return (
    pathname.startsWith("/c/") ||
    pathname.startsWith("/m/") ||
    pathname.startsWith("/t/")
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const setMobileFiltersOpen = useCatalogFilterStore(
    (s) => s.setMobileFiltersOpen,
  );
  useEffect(() => {
    setMobileFiltersOpen(false);
  }, [pathname, setMobileFiltersOpen]);
  const showFilter = isListingPath(pathname);

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  return (
    <nav
      data-testid="bottom-nav"
      aria-label="Menu inferior"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/10 bg-ink/92 px-1 pb-[max(env(safe-area-inset-bottom),20px)] pt-2 backdrop-blur-xl lg:hidden"
    >
      {left.map((tab) => (
        <NavTabLink key={tab.key} tab={tab} pathname={pathname} />
      ))}

      {showFilter && (
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          aria-label="Mở bộ lọc"
          className="-mt-7 flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border border-cyan/55 bg-gradient-to-br from-cyan/25 to-magenta/25 text-cyan shadow-[0_8px_24px_-6px_rgba(0,240,255,0.55)] transition active:scale-95"
        >
          <SlidersHorizontal className="h-5 w-5" strokeWidth={2.25} />
          <span className="text-[8px] uppercase tracking-[0.08em] [font-family:var(--font-orbitron)]">
            Bộ lọc
          </span>
        </button>
      )}

      {right.map((tab) => (
        <NavTabLink key={tab.key} tab={tab} pathname={pathname} />
      ))}
    </nav>
  );
}
function NavTabLink({
  tab,
  pathname,
}: {
  tab: NavTab;
  pathname: string | null;
}) {
  const Icon = tab.icon;
  const active = isActive(pathname, tab.href);
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 px-2 py-1 transition-colors",
        active ? "text-cyan" : "text-white/45 hover:text-white/70",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
      <span className="text-[9px] uppercase tracking-[0.08em] [font-family:var(--font-orbitron)]">
        {tab.label}
      </span>
    </Link>
  );
}
