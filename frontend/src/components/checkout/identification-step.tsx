"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { GoogleAuthButton } from "@/app/(auth)/_components/google-auth-button";
import { extractError } from "@/lib/extract-error";

type Mode = "choose" | "password" | "code" | "code-verify" | "guest";

interface IdentificationStepProps {
  onAuthenticated: () => void;
}

export function IdentificationStep({
  onAuthenticated,
}: IdentificationStepProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState("");

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[0.01em] text-white">
          Ai đang mua hàng?
        </h1>
        <p className="mx-auto mt-2.5 max-w-[420px] font-sans text-sm leading-snug text-white/72">
          Đã có tài khoản? Đăng nhập. Hoặc tiếp tục như khách và hoàn tất mua
          hàng trong vài bước.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-magenta/40 bg-magenta/10 px-4 py-3 text-sm text-magenta">
          {error}
        </div>
      )}

      {mode === "choose" && (
        <ChooseMode
          onPick={(m) => {
            setError("");
            setMode(m);
          }}
        />
      )}

      {mode === "password" && (
        <PasswordLogin
          onAuthenticated={onAuthenticated}
          onBack={() => setMode("choose")}
          onError={setError}
        />
      )}

      {(mode === "code" || mode === "code-verify") && (
        <CodeLogin
          mode={mode}
          setMode={setMode}
          onAuthenticated={onAuthenticated}
          onError={setError}
        />
      )}

      {mode === "guest" && (
        <GuestForm
          onAuthenticated={onAuthenticated}
          onBack={() => setMode("choose")}
          onError={setError}
        />
      )}

      <p className="mt-6 text-center font-sans text-xs leading-relaxed text-white/55">
        Đồng ý với{" "}
        <Link href="/privacy" className="text-cyan hover:text-white">
          Chính sách bảo mật
        </Link>{" "}
        và{" "}
        <Link href="/terms" className="text-cyan hover:text-white">
          Điều khoản sử dụng
        </Link>
        .
      </p>
    </>
  );
}

const AUTH_BTN_BASE =
  "flex w-full items-center gap-3.5 rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-left font-display text-sm text-white transition-all duration-[var(--dur-base)]";
const AUTH_BTN_HOVER = "hover:border-cyan/55 hover:bg-cyan/[0.04]";
const AUTH_BTN_GUEST =
  "flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-left font-display text-sm text-white/72 transition-all duration-[var(--dur-base)] hover:border-magenta/55 hover:text-magenta";

const IcCirc = ({ children }: { children: React.ReactNode }) => (
  <span className="grid size-[22px] flex-shrink-0 place-items-center rounded-full border border-cyan/55 bg-cyan/[0.12] text-cyan">
    {children}
  </span>
);

function ChooseMode({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <GoogleAuthButton
        mode="login"
        variant="auth-btn"
        defaultNext="/checkout"
      />

      <button
        type="button"
        onClick={() => onPick("password")}
        className={`${AUTH_BTN_BASE} ${AUTH_BTN_HOVER}`}
      >
        <IcCirc>
          <Lock className="size-[11px]" strokeWidth={2.5} />
        </IcCirc>
        Đăng nhập bằng mật khẩu
      </button>

      <button
        type="button"
        onClick={() => onPick("code")}
        className={`${AUTH_BTN_BASE} ${AUTH_BTN_HOVER}`}
      >
        <IcCirc>
          <Mail className="size-[11px]" strokeWidth={2.5} />
        </IcCirc>
        Nhận mã qua email
        <span className="ml-auto font-mono text-[11px] tracking-[0.06em] text-white/55">
          không cần mật khẩu
        </span>
      </button>

      <div className="my-[6px] flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
          hoặc
        </span>
        <span aria-hidden className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => onPick("guest")}
        className={AUTH_BTN_GUEST}
      >
        <span>Tiếp tục mà không đăng ký</span>
        <span aria-hidden className="font-mono text-base">
          →
        </span>
      </button>
    </div>
  );
}

const FORM_INPUT =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 font-mono text-[13px] text-white outline-none transition-all duration-[var(--dur-base)] placeholder:text-white/35 focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)]";

function PasswordLogin({
  onAuthenticated,
  onBack,
  onError,
}: {
  onAuthenticated: () => void;
  onBack: () => void;
  onError: (e: string) => void;
}) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const me = data.data;
      login(
        {
          id: me.user.id,
          email: me.user.email,
          name: me.user.name ?? undefined,
          role: me.user.role,
        },
        me.accessToken,
      );
      onAuthenticated();
    } catch (err) {
      onError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="user@gmail.com"
        required
        autoFocus
        className={FORM_INPUT}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu"
        required
        className={FORM_INPUT}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/10 px-4 py-3 font-display text-xs uppercase tracking-[0.1em] text-white/55 transition hover:border-white/25 hover:text-white"
        >
          ← Quay lại
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center rounded-xl py-3 font-display text-xs uppercase tracking-[0.1em] font-bold text-white shadow-[var(--glow-purple-sm)] transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "var(--grad-cta)" }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Đăng nhập"}
        </button>
      </div>
      <p className="text-center font-mono text-[11px] tracking-[0.04em] text-white/55">
        Quên mật khẩu?{" "}
        <Link href="/forgot-password" className="text-cyan hover:text-white">
          Lấy lại mật khẩu
        </Link>
      </p>
    </form>
  );
}

function CodeLogin({
  mode,
  setMode,
  onAuthenticated,
  onError,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  onAuthenticated: () => void;
  onError: (e: string) => void;
}) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError("");
    try {
      await api.post("/auth/login-code/request", { email, purpose: "LOGIN" });
      setMode("code-verify");
    } catch (err) {
      onError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError("");
    try {
      const { data } = await api.post("/auth/login-code/verify", {
        email,
        code,
      });
      const me = data.data;
      login(
        {
          id: me.user.id,
          email: me.user.email,
          name: me.user.name ?? undefined,
          role: me.user.role,
        },
        me.accessToken,
      );
      onAuthenticated();
    } catch (err) {
      onError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  if (mode === "code") {
    return (
      <form onSubmit={handleRequest} className="flex flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@gmail.com"
          required
          autoFocus
          className={FORM_INPUT}
        />
        <p className="font-mono text-[11px] tracking-[0.04em] text-white/55">
          Mã gồm 6 chữ số qua email. Hết hạn sau 10 phút.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="rounded-xl border border-white/10 px-4 py-3 font-display text-xs uppercase tracking-[0.1em] text-white/55 transition hover:border-white/25 hover:text-white"
          >
            ← Quay lại
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center rounded-xl py-3 font-display text-xs uppercase tracking-[0.1em] font-bold text-white shadow-[var(--glow-purple-sm)] transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--grad-cta)" }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Gửi mã"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-3">
      <p className="text-sm text-white/72">
        Chúng tôi đã gửi mã gồm 6 chữ số tới{" "}
        <strong className="text-white">{email}</strong>. Nhập mã ở dưới:
      </p>
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="000000"
        autoFocus
        required
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition-all duration-[var(--dur-base)] placeholder:text-white/35 focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("code")}
          className="rounded-xl border border-white/10 px-4 py-3 font-display text-xs uppercase tracking-[0.1em] text-white/55 transition hover:border-white/25 hover:text-white"
        >
          ← Gửi lại
        </button>
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="flex flex-1 items-center justify-center rounded-xl py-3 font-display text-xs uppercase tracking-[0.1em] font-bold text-white shadow-[var(--glow-purple-sm)] transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "var(--grad-cta)" }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Đăng nhập"}
        </button>
      </div>
    </form>
  );
}

function GuestForm({
  onAuthenticated,
  onBack,
  onError,
}: {
  onAuthenticated: () => void;
  onBack: () => void;
  onError: (e: string) => void;
}) {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifyHint, setIdentifyHint] = useState("");
  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEmailBlur() {
    if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
    if (!email || !email.includes("@")) {
      setIdentifyHint("");
      return;
    }
    identifyTimerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post("/auth/identify", { email });
        if (data.data?.exists) {
          setIdentifyHint(
            "Đã có tài khoản với email này — đăng nhập hoặc yêu cầu mã.",
          );
        } else {
          setIdentifyHint("");
        }
      } catch {}
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError("");
    try {
      const { data } = await api.post("/auth/guest-checkout", {
        email,
        marketingConsent,
      });
      const me = data.data;
      login(
        {
          id: me.user.id,
          email: me.user.email,
          name: me.user.name ?? undefined,
          role: me.user.role,
        },
        me.accessToken,
      );
      onAuthenticated();
    } catch (err) {
      onError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={handleEmailBlur}
        placeholder="user@gmail.com"
        required
        autoFocus
        className={FORM_INPUT}
      />
      {identifyHint && (
        <p className="font-mono text-[11px] tracking-[0.04em] text-amber-400">
          {identifyHint}
        </p>
      )}
      <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-white/72">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 size-4 cursor-pointer accent-magenta"
        />
        <span>
          Tôi đồng ý nhận tin tức, ưu đãi và các sản phẩm mới qua email.
        </span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-white/10 px-4 py-3 font-display text-xs uppercase tracking-[0.1em] text-white/55 transition hover:border-white/25 hover:text-white"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center rounded-xl py-3 font-display text-xs uppercase tracking-[0.1em] font-bold text-white shadow-[var(--glow-purple-sm)] transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "var(--grad-cta)" }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Tiếp tục →"}
        </button>
      </div>
    </form>
  );
}
