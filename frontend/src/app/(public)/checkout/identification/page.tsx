"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { IdentificationStep } from "@/components/checkout/identification-step";
import { useAuthStore } from "@/store/auth-store";
import { ROUTES } from "@/lib/constants";

export default function CheckoutIdentificationPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) router.replace(ROUTES.checkout);
  }, [user, router]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-3 font-mono text-[11px] tracking-[0.08em] lowercase text-white/55">
        <Link href={ROUTES.home} className="hover:text-cyan">
          Trang chủ
        </Link>
        <span className="mx-2 text-white/35">·</span>
        <Link href={ROUTES.cart} className="hover:text-cyan">
          Giỏ hàng
        </Link>
        <span className="mx-2 text-white/35">·</span>
        <span className="text-cyan">Xác nhận thông tin</span>
      </nav>

      <CheckoutStepper currentStep={2} className="mb-9 mt-6" />

      <div className="flex justify-center pb-20 pt-6">
        <div
          className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-magenta/35 bg-white/[0.015] px-9 py-10"
          style={{ borderColor: "rgba(184,41,255,0.35)" }}
        >
          <span
            aria-hidden
            className="absolute left-0 right-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--color-magenta, #b829ff), transparent)",
            }}
          />

          <IdentificationStep
            onAuthenticated={() => {
              router.push(ROUTES.checkout);
            }}
          />
        </div>
      </div>

      <div className="text-center pb-8">
        <Link
          href={ROUTES.cart}
          className="inline-flex items-center gap-1.5 font-display text-[11px] uppercase tracking-[0.1em] text-white/55 transition hover:text-cyan"
        >
          ← Quay lại giỏ hàng
        </Link>
      </div>
    </div>
  );
}
