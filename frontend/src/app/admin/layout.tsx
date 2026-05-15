"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Ruler,
  ShoppingBag,
  Users,
  Ticket,
  FileText,
  Tag,
  Award,
  Truck,
  Settings,
  Paintbrush,
  Megaphone,
  Layers,
  BarChart3,
  ImageIcon,
  Mail,
  Palette,
  Hammer,
  Globe,
  Shield,
  UserCircle,
  ArrowLeft,
  MessageCircleQuestion,
  Handshake,
  Gift,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME, ROUTES } from "@/lib/constants";
import { PendingQuestionsBadge } from "@/components/admin/pending-questions-badge";
import { PendingQuotesBadge } from "@/components/admin/pending-quotes-badge";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Sản phẩm", icon: Package },
  { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingBag },
  { href: "/admin/clients", label: "Khách hàng", icon: Users },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/coupons", label: "Mã giảm giá", icon: Ticket },
  { href: "/admin/free-gifts", label: "Quà tặng", icon: Gift },
  { href: "/admin/brands", label: "Thương hiệu", icon: Award },
  { href: "/admin/tags", label: "Tags", icon: Tag },
  { href: "/admin/colors", label: "Màu sắc", icon: Palette },
  { href: "/admin/materials", label: "Vật liệu", icon: Hammer },
  { href: "/admin/google-taxonomy", label: "Phân loại Google", icon: Globe },
  { href: "/admin/gallery", label: "Thư viện ảnh", icon: ImageIcon },
  { href: "/admin/attributes", label: "Thuộc tính", icon: Layers },
  { href: "/admin/scales", label: "Tỉ lệ", icon: Ruler, exact: true },
  { href: "/admin/stock", label: "Kho hàng", icon: BarChart3 },
  { href: "/admin/shipping", label: "Vận chuyển", icon: Truck },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/pages", label: "Trang", icon: FileText },
  { href: "/admin/questions", label: "Câu hỏi", icon: MessageCircleQuestion },
  { href: "/admin/reviews", label: "Đánh giá", icon: Star },
  { href: "/admin/quotes", label: "Báo giá", icon: FileText },
  { href: "/admin/affiliate", label: "Cộng tác viên", icon: Handshake },
  { href: "/admin/layout", label: "Giao diện", icon: Paintbrush },
  { href: "/admin/marketing/newsletter", label: "Newsletter", icon: Megaphone },
  { href: "/admin/security", label: "Bảo mật", icon: Shield },
  { href: "/admin/settings", label: "Cấu hình", icon: Settings },
  { href: "/admin/profile", label: "Thông tin cá nhân", icon: UserCircle },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "ADMIN")) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isHydrated, user, router, pathname]);

  if (!isHydrated || !isAuthenticated || user?.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen dark admin-panel">
      <aside className="w-60 h-screen border-r bg-muted/30 flex flex-col sticky top-0">
        <div className="p-4 border-b flex items-center gap-4">
          <Image
            src="/apple-touch-icon.png"
            width={50}
            height={50}
            quality={75}
            priority={true}
            alt="logo"
            sizes="100vw"
          />
          <Link href="/admin" className="font-bold text-2xl">
            {SITE_NAME}
          </Link>
          {/* <p className="text-xs text-muted-foreground">Admin</p> */}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.href === "/admin/questions" && <PendingQuestionsBadge />}
                {item.href === "/admin/quotes" && <PendingQuotesBadge />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1 flex-shrink-0">
          <Link
            href={ROUTES.home}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại trang chủ
          </Link>
          {/* <p className="text-[10px] text-muted-foreground/50 px-3">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
          </p> */}
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
