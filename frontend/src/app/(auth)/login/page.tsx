"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, getSessionId } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { ROUTES } from "@/lib/constants";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { extractError } from "@/lib/extract-error";
import { GoogleAuthButton } from "../_components/google-auth-button";

type Mode = "password" | "code-request" | "code-verify";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const setCart = useCartStore((s) => s.setCart);
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function postAuthSuccess() {
    try {
      const sessionId = getSessionId();
      const [{ data: mergeData }] = await Promise.all([
        api.post("/cart/merge", { sessionId }),
        api.post("/recently-viewed/merge", { sessionId }).catch(() => {}),
      ]);
      if (mergeData.data?.cart) {
        setCart(mergeData.data.cart.items, mergeData.data.cart.subtotal);
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const wishlistProductId = params.get("wishlist");
    if (wishlistProductId && /^c[a-z0-9]{20,30}$/.test(wishlistProductId)) {
      try {
        await api.post(`/wishlist/${wishlistProductId}`);
      } catch {}
    }

    const returnTo = params.get("returnTo");
    router.push(safeRedirectPath(returnTo, ROUTES.account));
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
        rememberMe,
      });
      login(data.data.user, data.data.accessToken);
      await postAuthSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/login-code/request", { email, purpose: "LOGIN" });
      setCode("");
      setMode("code-verify");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login-code/verify", {
        email,
        code,
        rememberMe,
      });

      login(data.data.user, data.data.accessToken);
      await postAuthSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function switchToCode() {
    setError("");
    setCode("");
    setMode("code-request");
  }

  function switchToPassword() {
    setError("");
    setMode("password");
  }

  return (
    <div className="mt-7 space-y-4">
      {error && (
        <p className="rounded-xl border border-magenta/40 bg-magenta/10 px-4 py-3 text-center text-sm text-magenta">
          {error}
        </p>
      )}

      {mode === "password" && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                Mật khẩu
              </span>
              <Link
                href="/forgot-password"
                className="text-[11px] text-cyan hover:underline"
              >
                Quên mật khẩu
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-magenta"
            />
            Lưu đăng nhập
          </label>

          <Button
            type="submit"
            variant="neon"
            className="w-full rounded-full py-6 text-sm"
            disabled={loading}
          >
            {loading ? "ĐĂNG NHẬP…" : "ĐĂNG NHẬP →"}
          </Button>
        </form>
      )}

      {mode === "code-request" && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <KeyRound className="h-4 w-4 text-cyan" />
            <span>Nhập email để nhận mã gồm 6 số.</span>
          </div>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              E-mail
            </span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="user@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
            />
          </label>

          <p className="text-xs text-white/50">
            Mã có giá trị trong 5 phút. Không chia sẻ với bất kỳ ai.
          </p>

          <Button
            type="submit"
            variant="neon"
            className="w-full rounded-full py-6 text-sm"
            disabled={loading || !email}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "GỬI MÃ →"
            )}
          </Button>

          <button
            type="button"
            onClick={switchToPassword}
            className="block w-full text-center text-xs text-white/50 hover:text-cyan hover:underline"
          >
            ← Quay lại đăng nhập bằng mật khẩu
          </button>
        </form>
      )}

      {mode === "code-verify" && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <p className="text-sm text-white/70">
            Mã đã được gửi tới <strong className="text-white">{email}</strong>.
            Dán mã dưới đây:
          </p>

          <input
            type="email"
            value={email}
            readOnly
            tabIndex={-1}
            aria-label="Mã"
            className="w-full rounded-xl border border-purple/10 bg-black/20 px-4 py-2 text-xs text-white/40"
          />

          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full rounded-xl border border-purple/15 bg-black/40 px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-white/20 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-magenta"
            />
            Lưu đăng nhập
          </label>

          <Button
            type="submit"
            variant="neon"
            className="w-full rounded-full py-6 text-sm"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "ĐĂNG NHẬP →"
            )}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setMode("code-request")}
              className="text-white/50 hover:text-cyan hover:underline"
            >
              Gửi lại mã
            </button>
            <button
              type="button"
              onClick={switchToPassword}
              className="text-white/50 hover:text-cyan hover:underline"
            >
              Quay lại đăng nhập bằng mật khẩu
            </button>
          </div>
        </form>
      )}

      {mode === "password" && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-white/40">
              hoặc tiếp tục với
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <GoogleAuthButton mode="login" />

          <Button
            type="button"
            variant="outline"
            onClick={switchToCode}
            className="w-full rounded-full py-6 text-sm"
          >
            <Mail className="mr-2 h-4 w-4" />
            Đăng nhập bằng email
          </Button>

          <p className="pt-2 text-center text-sm text-white/50">
            Bạn mới?{" "}
            <Link href={ROUTES.register} className="text-cyan hover:underline">
              Tạo tài khoản miễn phí
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
