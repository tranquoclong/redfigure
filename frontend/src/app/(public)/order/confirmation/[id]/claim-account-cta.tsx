"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export function ClaimAccountCta() {
  const user = useAuthStore((s) => s.user);

  if (!user || user.passwordSet) return null;

  return (
    <div className="mx-auto mb-8 max-w-md rounded-xl border border-cyan/40 bg-cyan/5 p-5 text-left">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-cyan">
            Theo dõi đơn hàng của bạn
          </h3>
          <p className="mt-1 text-xs text-white/70">
            Tạo mật khẩu nhanh để xem lịch sử, mua lại và nhận thông tin cập
            nhật.
          </p>
          <Link
            href={`/reset-password?email=${encodeURIComponent(user.email)}`}
            className="mt-3 inline-block text-xs font-medium text-cyan hover:underline"
          >
            Tạo mật khẩu trong 1 click →
          </Link>
        </div>
      </div>
    </div>
  );
}
