"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { GoogleAuthButton } from "../_components/google-auth-button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", { name, email, password });
      const params = new URLSearchParams(window.location.search);
      const rawReturnTo = params.get("returnTo");
      const sanitized = rawReturnTo ? safeRedirectPath(rawReturnTo, "") : "";
      const safeReturnTo = sanitized !== "" ? sanitized : null;
      const wishlist = params.get("wishlist");
      let loginUrl = ROUTES.login + "?registered=1";
      if (safeReturnTo)
        loginUrl += `&returnTo=${encodeURIComponent(safeReturnTo)}`;
      if (wishlist && /^c[a-z0-9]{20,30}$/.test(wishlist)) {
        loginUrl += `&wishlist=${wishlist}`;
      }
      router.push(loginUrl);
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: {
              error?: { message?: string; details?: string[] };
              message?: string;
            };
          };
        }
      )?.response?.data;
      const details = resp?.error?.details;
      const msg = resp?.error?.message ?? resp?.message;
      if (Array.isArray(details)) {
        setError(details.join(". "));
      } else {
        setError(msg ?? "Lỗi khi tạo tài khoản");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      {error && (
        <p className="rounded-xl border border-magenta/40 bg-magenta/10 px-4 py-3 text-center text-sm text-magenta">
          {error}
        </p>
      )}

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
          Họ và tên
        </span>
        <input
          type="text"
          required
          minLength={3}
          autoComplete="name"
          placeholder="Họ và tên"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
        />
      </label>

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

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
          Mật khẩu
        </span>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
        />
        <p className="mt-1 text-[11px] text-white/40">Tối thiểu 10 ký tự</p>
      </label>

      <Button
        type="submit"
        variant="neon"
        className="w-full rounded-full py-6 text-sm"
        disabled={loading}
      >
        {loading ? "TẠO TÀI KHOẢN…" : "TẠO TÀI KHOẢN →"}
      </Button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[11px] uppercase tracking-wider text-white/40">
          Hoặc đăng ký với
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <GoogleAuthButton mode="register" />

      <p className="text-center text-sm text-white/50 pt-2">
        Đã có tài khoản?{" "}
        <Link href={ROUTES.login} className="text-cyan hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
