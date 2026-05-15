"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ROUTES } from "@/lib/constants";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-cyan" />
    </div>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (autoSubmittedRef.current) return;
    const queryEmail = searchParams.get("email");
    if (queryEmail && !submitted) {
      autoSubmittedRef.current = true;
      void submit(queryEmail);
    }
  }, []);

  async function submit(targetEmail: string) {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email: targetEmail });
      setSubmitted(true);
    } catch (err) {
      const resp = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setError(resp?.error?.message ?? "có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(email);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <KeyRound className="mx-auto mb-4 h-12 w-12 text-cyan" />
        <h1 className="text-2xl font-semibold">Kiểm tra email của bạn</h1>
        <p className="mt-3 text-sm text-white/70">
          Nếu có tài khoản với <strong>{email}</strong>, tôi đã gửi một liên kết
          để bạn đặt lại mật khẩu. Kiểm tra cả hộp thư rác.
        </p>
        <p className="mt-6 text-xs text-white/40">
          Liên kết sẽ hết hạn sau 1 giờ.
        </p>
        <Link
          href={ROUTES.login}
          className="mt-6 inline-block text-sm text-cyan hover:underline"
        >
          ← Quay lại đăng nhập bằng mật khẩu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <KeyRound className="mx-auto mb-4 h-10 w-10 text-cyan" />
      <h1 className="text-center text-2xl font-semibold">Truy cập tài khoản</h1>
      <p className="mt-3 text-center text-sm text-white/70">
        Nhập email — tôi sẽ gửi một liên kết để bạn đặt lại mật khẩu và xem lịch
        sử đơn hàng của bạn.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@gmail.com"
          required
          autoFocus
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm"
        />
        <Button
          type="submit"
          disabled={loading || !email}
          className="w-full py-6"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Gửi liên kết qua email"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-white/50">
        Bạn đã có mật khẩu?{" "}
        <Link href={ROUTES.login} className="text-cyan hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
