"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function AuthFormPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname.startsWith("/login");
  const isRegister = pathname.startsWith("/register");
  const showTabs = isLogin || isRegister;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple/25 bg-white/[0.02] p-8 backdrop-blur-sm md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(184,41,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(184,41,255,0.08) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <div className="relative">
        {showTabs && (
          <>
            <div className="text-xs uppercase tracking-[0.3em] text-cyan/80">
              {"// truy cập"}
            </div>
            <h1 className="mt-2 text-3xl text-white md:text-4xl">
              {isLogin ? (
                <>
                  ĐĂNG NHẬP
                  {/* <span className="drop-shadow-[0_0_22px_rgba(184,41,255,0.7)]">
                    ĐỎ
                  </span> */}
                </>
              ) : (
                <>
                  TẠO TÀI KHOẢN{" "}
                  {/* <span className="drop-shadow-[0_0_22px_rgba(0,240,255,0.7)]">
                    ĐỎ
                  </span> */}
                </>
              )}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {isLogin
                ? "Đăng nhập để theo dõi đơn hàng, danh sách yêu thích và mã giảm giá độc quyền."
                : "Tạo tài khoản miễn phí để lưu yêu thích, theo dõi đơn hàng và nhận mã giảm giá."}
            </p>
            <div className="mt-6 inline-flex gap-1 rounded-full border border-purple/25 bg-black/40 p-1">
              <Link
                href={ROUTES.login}
                className={cn(
                  "rounded-full px-5 py-2 text-xs tracking-wider transition-all",
                  isLogin
                    ? "bg-gradient-to-br from-purple to-magenta text-white shadow-[0_0_18px_rgba(184,41,255,0.45)]"
                    : "text-white/60 hover:text-white",
                )}
              >
                ĐĂNG NHẬP
              </Link>
              <Link
                href={ROUTES.register}
                className={cn(
                  "rounded-full px-5 py-2 text-xs tracking-wider transition-all",
                  isRegister
                    ? "bg-gradient-to-br from-purple to-magenta text-white shadow-[0_0_18px_rgba(184,41,255,0.45)]"
                    : "text-white/60 hover:text-white",
                )}
              >
                TẠO TÀI KHOẢN
              </Link>
            </div>
          </>
        )}

        {children}

        <div className="mt-6 text-center text-[11px] text-white/30">
          🔒 Dữ liệu được bảo vệ
        </div>
      </div>
    </div>
  );
}

export function AuthBreadcrumb() {
  const pathname = usePathname();
  const isLogin = pathname.startsWith("/login");
  const isRegister = pathname.startsWith("/register");
  const isPasswordRecovery = pathname.startsWith("/forgot-password");
  return (
    <div className="text-xs text-white/50 mb-4">
      <Link href={ROUTES.home} className="hover:text-cyan">
        Trang chủ
      </Link>
      <span className="mx-2">·</span>
      <span className="text-cyan">
        {isLogin && "Đăng nhập"}
        {isRegister && "Tạo tài khoản"}
        {isPasswordRecovery && "Lấy lại mật khẩu"}
      </span>
    </div>
  );
}
