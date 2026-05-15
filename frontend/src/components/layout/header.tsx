"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  User,
  Heart,
  Menu as MenuIcon,
  X,
  Search,
} from "lucide-react";
import { useState } from "react";
import { ROUTES } from "@/lib/constants";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { useMiniCart } from "@/hooks/use-mini-cart";
import { Button } from "@/components/ui/button";
import { SearchInput } from "./search-input";
import { MobileSearchOverlay } from "./mobile-search-overlay";
import { MiniCart } from "./mini-cart";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { MegaMenuItem, MenuItem } from "@/lib/site-content";

export interface HeaderProps {
  menu?: MenuItem[];

  megamenu?: MegaMenuItem[];
}

const BADGE_COLORS = {
  NEW: "bg-cyan/15 text-cyan border-cyan/45",
  HOT: "bg-magenta/15 text-magenta border-magenta/45",
  SALE: "bg-purple/15 text-purple border-purple/45",
} as const;

export function Header({ menu, megamenu }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const openCart = useMiniCart((s) => s.openCart);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const itemCount = useCartStore((s) => s.itemCount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();

  const items: MegaMenuItem[] =
    megamenu ??
    (menu ?? []).map((m) => ({
      id: m.href,
      label: m.label,
      href: m.href,
    }));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-[76px] items-center gap-6 lg:gap-8">
            <Link
              href={ROUTES.home}
              aria-label="Red Figure — trang chủ"
              className="flex items-center shrink-0"
            >
              <Image
                src="/apple-touch-icon.png"
                width={60}
                height={60}
                quality={75}
                priority={true}
                alt="logo"
                sizes="100vw"
              />
            </Link>

            <nav className="hidden items-center gap-7 lg:flex">
              {items.map((item) => {
                const hasDropdown = item.columns && item.columns.length > 0;
                const isOpen = openItemId === item.id;

                const isActive =
                  pathname == null
                    ? false
                    : item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => hasDropdown && setOpenItemId(item.id)}
                    onMouseLeave={() => hasDropdown && setOpenItemId(null)}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "group/nav relative flex items-center gap-1.5 py-1.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)]",
                        isActive
                          ? "text-white"
                          : "text-[color:var(--fg-2)] hover:text-cyan",
                      )}
                    >
                      {item.label}

                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-x-0 -bottom-0.5 h-[2px] origin-center transition-transform duration-[var(--dur-base)] [transition-timing-function:var(--ease-out)]",
                          isActive
                            ? "scale-x-100"
                            : "scale-x-0 group-hover/nav:scale-x-100",
                        )}
                        style={{ background: "var(--grad-rule)" }}
                      />
                      {item.badge && (
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase [font-family:var(--font-orbitron)]",
                            BADGE_COLORS[item.badge],
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>

                    {hasDropdown && isOpen && (
                      <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3 z-50">
                        <div className="rounded-2xl border border-purple/25 bg-ink/95 p-6 shadow-[0_20px_60px_-10px_rgba(184,41,255,0.45)] backdrop-blur-md min-w-[420px]">
                          <div className="grid grid-cols-2 gap-6">
                            {item.columns!.map((col) => (
                              <div key={col.title}>
                                <p className="text-[10px] uppercase tracking-wider text-cyan [font-family:var(--font-orbitron)] mb-3">
                                  {col.title}
                                </p>
                                <ul className="space-y-2">
                                  {col.links.map((link) => (
                                    <li key={link.href}>
                                      <Link
                                        href={link.href}
                                        className="text-sm text-white/70 hover:text-white"
                                      >
                                        {link.label}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                          {item.featuredImage && (
                            <Link
                              href={item.featuredImage.href}
                              className="mt-5 flex items-center gap-3 rounded-xl border border-cyan/30 p-3 hover:border-cyan/60"
                            >
                              <img
                                src={item.featuredImage.url}
                                alt=""
                                className="h-12 w-12 rounded object-cover"
                              />
                              {item.featuredImage.caption && (
                                <span className="text-xs text-cyan">
                                  {item.featuredImage.caption}
                                </span>
                              )}
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <SearchInput />

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Tìm kiếm"
                className="grid h-10 w-10 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
              >
                <Search className="h-5 w-5" />
              </button>

              <Link
                href={isAuthenticated ? ROUTES.account : ROUTES.login}
                className="hidden lg:inline-flex"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Tài khoản"
                  className="text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <User className="h-5 w-5" />
                </Button>
              </Link>

              <Link href={ROUTES.wishlist} className="hidden lg:inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Yêu thích"
                  className="text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>

              <button
                onClick={() => openCart()}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Giỏ hàng"
              >
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-magenta text-[10px] font-bold text-white shadow-[0_0_8px_#ff007a]">
                    {itemCount}
                  </span>
                )}
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:bg-white/5 hover:text-white lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <MenuIcon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="flex flex-col gap-1 border-t border-white/10 py-4 lg:hidden">
              {items.map((item) => (
                <div key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-sm text-white/80 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                  {item.columns?.map((col) => (
                    <div key={col.title} className="ml-4 mt-1 mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-cyan/70 [font-family:var(--font-orbitron)]">
                        {col.title}
                      </p>
                      {col.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block py-1.5 text-xs text-white/60 hover:text-white"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </nav>
          )}
        </div>
      </header>

      <MiniCart />
      <MobileSearchOverlay
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
      />
    </>
  );
}
