"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SafeHtml } from "@/components/ui/safe-html";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const contactSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập tên").max(120, "Tên quá dài"),
  email: z.string().trim().email("Email không hợp lệ").max(254),
  message: z
    .string()
    .trim()
    .min(10, "Nội dung quá ngắn (tối thiểu 10 ký tự)")
    .max(5000, "Nội dung quá dài"),
  acceptLgpd: z.literal(true, {
    message: "Chấp nhận Chính sách bảo mật",
  }),

  website: z.string().max(200).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface PageData {
  title: string;
  content: string;
}

export default function ContactPage() {
  const [page, setPage] = useState<PageData | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "success" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
      acceptLgpd: false as unknown as true,
      website: "",
    },
  });

  useEffect(() => {
    api
      .get("/pages/contact")
      .then(({ data }) => setPage(data.data ?? data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!turnstileLoaded || !turnstileRef.current || !SITE_KEY) return;
    if (widgetIdRef.current) return;

    const id = window.turnstile!.render(turnstileRef.current, {
      sitekey: SITE_KEY,
      theme: "dark",
      callback: (token: string) => setTurnstileToken(token),
      "error-callback": () => setTurnstileToken(""),
      "expired-callback": () => setTurnstileToken(""),
    });
    widgetIdRef.current = id;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileLoaded]);

  const onSubmit = async (values: ContactFormValues) => {
    if (!SITE_KEY) {
      setSubmitStatus({
        kind: "error",
        message: "Liên hệ không khả dụng: Cấu hình khóa Turnstile bị lỗi.",
      });
      return;
    }
    if (!turnstileToken) {
      setSubmitStatus({
        kind: "error",
        message: "Chờ xác minh bảo mật.",
      });
      return;
    }

    setSubmitStatus({ kind: "submitting" });
    try {
      await api.post("/contact", {
        name: values.name,
        email: values.email,
        message: values.message,
        acceptLgpd: values.acceptLgpd,
        turnstileToken,
        website: values.website ?? "",
      });
      setSubmitStatus({ kind: "success" });
      resetForm();
      setTurnstileToken("");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } catch (err) {
      const message =
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } } | undefined)
            ?.error?.message) ||
        "Không thể gửi tin nhắn. Vui lòng thử lại sau.";
      setSubmitStatus({ kind: "error", message });
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-16">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setTurnstileLoaded(true)}
      />

      <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-wide text-white">
        {page?.title ?? "Liên hệ"}
      </h1>
      <div className="h-1 w-20 bg-gradient-to-r from-magenta to-cyan rounded-full mb-10" />

      {page?.content && (
        <SafeHtml className="prose-elite mb-10" html={page.content} />
      )}

      {submitStatus.kind === "success" ? (
        <div
          role="status"
          className="rounded-xl border border-cyan/50 bg-cyan/10 px-6 py-5 text-cyan [font-family:var(--font-inter)] shadow-lg shadow-cyan/10"
        >
          <p className="text-lg font-bold mb-1 [font-family:var(--font-orbitron)]">
            Tin nhắn đã gửi!
          </p>
          <p className="text-base text-white/85">
            Đã nhận được tin nhắn và sẽ trả lời sớm qua email.
          </p>
          <button
            type="button"
            onClick={() => setSubmitStatus({ kind: "idle" })}
            className="mt-4 text-sm underline underline-offset-4 hover:text-white"
          >
            Gửi tin nhắn khác
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-7 rounded-2xl border border-white/10 bg-ink-soft/30 p-6 sm:p-8 backdrop-blur-sm"
          noValidate
        >
          <div
            aria-hidden="true"
            className="absolute h-0 w-0 overflow-hidden opacity-0"
            style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
          >
            <label htmlFor="contact-website">
              Không điền trường này (chỉ dành cho bot):
            </label>
            <input
              {...register("website")}
              id="contact-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="name"
              className="text-sm font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
            >
              Tên
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Tên của bạn"
              className={cn(
                "h-12 text-base bg-ink/60 border-white/15 text-white placeholder:text-white/30",
                "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
                errors.name && "border-red-500/70",
              )}
            />
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              placeholder="user@gmail.com"
              className={cn(
                "h-12 text-base bg-ink/60 border-white/15 text-white placeholder:text-white/30",
                "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
                errors.email && "border-red-500/70",
              )}
            />
            {errors.email && (
              <p className="text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="message"
              className="text-sm font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
            >
              Lời nhắn
            </Label>
            <Textarea
              id="message"
              {...register("message")}
              rows={6}
              placeholder="Nhập nội dung lời nhắn..."
              className={cn(
                "text-base leading-relaxed bg-ink/60 border-white/15 text-white placeholder:text-white/30",
                "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
                errors.message && "border-red-500/70",
              )}
            />
            {errors.message && (
              <p className="text-sm text-red-400">{errors.message.message}</p>
            )}
          </div>

          <div className="pt-1">
            {SITE_KEY ? (
              <div ref={turnstileRef} />
            ) : (
              <p className="text-xs text-amber-400/80">
                ⚠️ Turnstile chưa được cấu hình.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75 leading-relaxed">
            <input
              type="checkbox"
              {...register("acceptLgpd")}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-magenta"
            />
            <span>
              Tôi đã đọc và đồng ý với{" "}
              <Link
                href="/privacy"
                className="text-magenta hover:text-cyan underline underline-offset-2 font-medium"
              >
                Chính sách bảo mật
              </Link>
              . Dữ liệu sẽ chỉ được sử dụng để trả lời tin nhắn này.
            </span>
          </label>
          {errors.acceptLgpd && (
            <p className="-mt-4 text-sm text-red-400">
              {errors.acceptLgpd.message}
            </p>
          )}

          {submitStatus.kind === "error" && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border-l-4 border-red-500 bg-red-500/15 px-4 py-3 text-[15px] text-red-200"
            >
              <span aria-hidden className="mt-0.5 text-lg leading-none">
                ⚠
              </span>
              <span className="flex-1">{submitStatus.message}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || submitStatus.kind === "submitting"}
            className="w-full h-12 bg-magenta hover:bg-magenta/90 text-white text-base font-bold [font-family:var(--font-orbitron)] tracking-wider disabled:opacity-50 shadow-lg shadow-magenta/30 hover:shadow-magenta/40 transition-all"
          >
            {submitStatus.kind === "submitting"
              ? "Đang gửi..."
              : "Gửi tin nhắn"}
          </Button>
        </form>
      )}
    </div>
  );
}
