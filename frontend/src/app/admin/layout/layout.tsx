"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FlushCacheButton } from "./flush-cache-button";
import { CacheToggle } from "./cache-toggle";

interface Tab {
  href: string;
  label: string;
  enabled: boolean;
  badge?: string;
}

const TABS: Tab[] = [
  { href: "/admin/layout/header", label: "Header & Marquee", enabled: true },
  { href: "/admin/layout/mega-menu", label: "Mega Menu", enabled: true },
  { href: "/admin/layout/banners", label: "Banners", enabled: true },
  { href: "/admin/layout/home", label: "Home", enabled: true },
  { href: "/admin/layout/footer", label: "Footer", enabled: true },
  { href: "/admin/layout/general", label: "General", enabled: true },
];

export default function LayoutHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cấu hình trang</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chỉnh sửa nội dung trang (header, banners, home, footer) mà không
            cần sửa code.
            <span className="block mt-0.5 text-[11px] text-muted-foreground/80">
              TTL Redis: 1h. Thay đổi sẽ tự động vô hiệu hóa cache. "Xóa cache"
              buộc làm mới ngay lập tức.
            </span>
          </p>
        </div>
        <div className="flex items-start gap-4">
          <CacheToggle />
          <FlushCacheButton />
        </div>
      </div>

      <nav className="border-b border-border">
        <ul className="flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            const baseClasses =
              "inline-flex items-center gap-2 rounded-t-md px-4 py-2.5 text-sm font-medium border-b-2 transition-colors";
            if (!tab.enabled) {
              return (
                <li key={tab.href}>
                  <span
                    className={cn(
                      baseClasses,
                      "border-transparent text-muted-foreground/40 cursor-not-allowed",
                    )}
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    {tab.label}
                    {tab.badge && (
                      <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </li>
              );
            }
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    baseClasses,
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div>{children}</div>
    </div>
  );
}
