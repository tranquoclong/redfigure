"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="text-xs uppercase tracking-[0.3em] text-cyan/80">
        {"// lấy lại mật khẩu"}
      </div>
      <h1 className="mt-2 text-3xl text-white md:text-4xl [font-family:var(--font-orbitron)]">
        QUÊN MẬT KHẨU{" "}
        <span className="drop-shadow-[0_0_22px_rgba(184,41,255,0.7)]"> ? </span>
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Nhập email và tôi sẽ gửi một liên kết để đặt lại mật khẩu.
      </p>

      {sent ? (
        <div className="mt-7 space-y-4">
          <div className="rounded-xl border border-cyan/40 bg-cyan/5 px-4 py-4 text-center text-sm text-cyan">
            ✓ Nếu email tồn tại trong cơ sở dữ liệu, tôi sẽ gửi cho bạn một liên
            kết trong vài phút.
            <br />
            Kiểm tra hộp thư đến và thư rác.
          </div>
          <Link
            href={ROUTES.login}
            className="block text-center text-sm text-cyan hover:underline"
          >
            ← Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              E-mail
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="user@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
            />
          </label>
          <Button
            type="submit"
            variant="neon"
            className="w-full rounded-full py-6 text-sm"
            disabled={loading}
          >
            {loading ? "ĐANG GỬI…" : "GỬI LIÊN KẾT →"}
          </Button>
          <Link
            href={ROUTES.login}
            className="block text-center text-sm text-white/50 hover:text-cyan"
          >
            ← Quay lại đăng nhập
          </Link>
        </form>
      )}
    </div>
  );
}
