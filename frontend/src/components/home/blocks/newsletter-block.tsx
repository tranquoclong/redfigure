"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import type { NewsletterData } from "@/lib/home-blocks";
import { SectionHead } from "./_section-head";

interface Props {
  data: NewsletterData;
}

export function NewsletterBlock({ data }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/newsletter/subscribe", {
        email: email.trim(),
        source: "home",
      });
      setSubmitted(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 429) {
        setError("Hãy thử lại sau vài phút.");
      } else if (status === 400) {
        setError("Email không hợp lệ.");
      } else {
        setError("Xin lỗi. Hãy thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <div
        className="relative overflow-hidden rounded-2xl border p-10 md:p-14"
        style={{
          borderColor: "rgba(184,41,255,0.55)",
          background:
            "radial-gradient(60% 80% at 80% 20%, rgba(184,41,255,0.18), transparent 60%), radial-gradient(60% 80% at 20% 80%, rgba(0,240,255,0.10), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent 0 3px, rgba(255,255,255,0.02) 3px 4px)",
          }}
        />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <SectionHead eyebrow={data.eyebrow} title={data.title} />
            <p className="-mt-3 max-w-md text-[15px] leading-relaxed text-white/72">
              {data.description}
            </p>
          </div>
          {submitted ? (
            <div className="rounded-2xl border border-cyan/55 bg-cyan/10 px-5 py-4 text-center text-sm text-cyan">
              ✓ Hãy kiểm tra email của bạn để xác nhận đăng ký ({email}). Nó có
              thể ở trong thư mục spam.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@gmail.com"
                  disabled={loading}
                  className="flex-1 rounded-full border border-white/10 bg-black/40 px-5 py-3.5 text-sm text-white placeholder:text-white/40 focus:border-cyan/70 focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full px-7 py-3.5 text-[13px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-110 hover:-translate-y-px disabled:opacity-60"
                  style={{
                    background: "var(--grad-cta)",
                    boxShadow: "var(--glow-purple)",
                  }}
                >
                  {loading ? "Đang gửi…" : data.ctaLabel}
                </button>
              </form>
              {error && <p className="px-2 text-xs text-magenta">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
