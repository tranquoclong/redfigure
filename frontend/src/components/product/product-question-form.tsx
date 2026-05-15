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
import { useAuthStore } from "@/store/auth-store";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const loggedSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Câu hỏi quá ngắn (tối thiểu 5 ký tự)")
    .max(1000, "Câu hỏi quá dài"),
  acceptLgpd: z.literal(true, {
    message: "Bạn phải chấp nhận Chính sách Bảo mật",
  }),
  website: z.string().max(200).optional(),
});

const guestSchema = loggedSchema.extend({
  askerName: z
    .string()
    .trim()
    .min(2, "Tên quá ngắn (tối thiểu 2 ký tự)")
    .max(120, "Tên quá dài"),
  askerEmail: z.string().trim().email("Email không hợp lệ").max(254),
});

type LoggedValues = z.infer<typeof loggedSchema>;
type GuestValues = z.infer<typeof guestSchema>;

interface Props {
  productId: string;
  productName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductQuestionForm({
  productId,
  productName,
  onSuccess,
  onCancel,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const isLogged = !!user;

  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoggedValues | GuestValues>({
    resolver: zodResolver(isLogged ? loggedSchema : guestSchema),
    defaultValues: {
      question: "",
      acceptLgpd: false as unknown as true,
      website: "",
      ...(isLogged ? {} : { askerName: "", askerEmail: "" }),
    } as LoggedValues | GuestValues,
  });

  useEffect(() => {
    if (isLogged) return;
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
  }, [turnstileLoaded, isLogged]);

  const onSubmit = async (values: LoggedValues | GuestValues) => {
    if (!isLogged && !SITE_KEY) {
      setSubmitStatus({
        kind: "error",
        message: "Form tạm thời không khả dụng: chưa có Turnstile.",
      });
      return;
    }
    if (!isLogged && !turnstileToken) {
      setSubmitStatus({
        kind: "error",
        message: "Vui lòng chờ xác thực bảo mật.",
      });
      return;
    }

    setSubmitStatus({ kind: "submitting" });
    try {
      const payload: Record<string, unknown> = {
        productId,
        question: values.question,
        acceptLgpd: values.acceptLgpd,
        website: values.website ?? "",
      };
      if (!isLogged) {
        const guest = values as GuestValues;
        payload.askerName = guest.askerName;
        payload.askerEmail = guest.askerEmail;
        payload.turnstileToken = turnstileToken;
      }
      await api.post("/product-questions", payload);
      onSuccess();
    } catch (err) {
      const message =
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } } | undefined)
            ?.error?.message) ||
        "Không thể gửi câu hỏi. Vui lòng thử lại sau.";
      setSubmitStatus({ kind: "error", message });
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken("");
      }
    }
  };

  return (
    <>
      {!isLogged && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
          onLoad={() => setTurnstileLoaded(true)}
        />
      )}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-xl border border-white/10 bg-ink-soft/40 p-6 backdrop-blur-sm"
        noValidate
      >
        <div>
          <h3 className="text-lg text-white [font-family:var(--font-orbitron)] tracking-wide">
            Hỏi về sản phẩm {productName}
          </h3>
          <p className="text-xs text-white/55 mt-1">
            Chúng tôi sẽ trả lời qua email. Câu hỏi của bạn sẽ chỉ xuất hiện sau
            khi được trả lời.
          </p>
        </div>

        <div
          aria-hidden="true"
          className="absolute h-0 w-0 overflow-hidden opacity-0"
          style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
        >
          <label htmlFor="q-website">Không điền vào ô này:</label>
          <input
            {...register("website")}
            id="q-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {!isLogged && (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="askerName"
                className="text-xs font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
              >
                Tên
              </Label>
              <Input
                id="askerName"
                {...register("askerName" as keyof GuestValues)}
                placeholder="Tên của bạn"
                className={cn(
                  "h-11 text-base bg-ink/60 border-white/15 text-white placeholder:text-white/30",
                  "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
                  "askerName" in errors && "border-red-500/70",
                )}
              />
              {"askerName" in errors && errors.askerName && (
                <p className="text-sm text-red-400">
                  {errors.askerName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="askerEmail"
                className="text-xs font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
              >
                Email
              </Label>
              <Input
                id="askerEmail"
                type="email"
                autoComplete="email"
                {...register("askerEmail" as keyof GuestValues)}
                placeholder="user@gmail.com"
                className={cn(
                  "h-11 text-base bg-ink/60 border-white/15 text-white placeholder:text-white/30",
                  "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
                  "askerEmail" in errors && "border-red-500/70",
                )}
              />
              {"askerEmail" in errors && errors.askerEmail && (
                <p className="text-sm text-red-400">
                  {errors.askerEmail.message}
                </p>
              )}
            </div>
          </>
        )}

        {isLogged && (
          <p className="text-xs text-white/55 border-l-2 border-cyan/40 pl-3">
            Bạn đang đăng nhập với tư cách{" "}
            <strong>{user.name ?? user.email}</strong>— chúng tôi sẽ trả lời qua
            email của tài khoản.
          </p>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="question"
            className="text-xs font-semibold uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
          >
            Câu hỏi của bạn
          </Label>
          <Textarea
            id="question"
            rows={4}
            {...register("question")}
            placeholder="Ví dụ: Mô hình này có tương thích với tỉ lệ 28mm không?"
            className={cn(
              "text-base leading-relaxed bg-ink/60 border-white/15 text-white placeholder:text-white/30",
              "focus-visible:border-magenta focus-visible:ring-2 focus-visible:ring-magenta/40",
              errors.question && "border-red-500/70",
            )}
          />
          {errors.question && (
            <p className="text-sm text-red-400">{errors.question.message}</p>
          )}
        </div>

        {!isLogged && (
          <div className="pt-1">
            {SITE_KEY ? (
              <div ref={turnstileRef} />
            ) : (
              <p className="text-xs text-amber-400/80">
                ⚠️ Turnstile chưa được cấu hình.
              </p>
            )}
          </div>
        )}

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
              target="_blank"
            >
              Chính sách Bảo mật
            </Link>
            .
          </span>
        </label>
        {errors.acceptLgpd && (
          <p className="-mt-3 text-sm text-red-400">
            {errors.acceptLgpd.message}
          </p>
        )}

        {submitStatus.kind === "error" && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border-l-4 border-red-500 bg-red-500/15 px-4 py-3 text-sm text-red-200"
          >
            <span aria-hidden className="mt-0.5 text-lg leading-none">
              ⚠
            </span>
            <span className="flex-1">{submitStatus.message}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-11 px-6 border border-white/25 text-white/80 hover:bg-white/10 hover:text-white"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || submitStatus.kind === "submitting"}
            className="h-11 px-8 bg-magenta hover:bg-magenta/90 text-white font-bold [font-family:var(--font-orbitron)] tracking-wider disabled:opacity-50"
          >
            {submitStatus.kind === "submitting" ? "Gửi..." : "Gửi câu hỏi"}
          </Button>
        </div>
      </form>
    </>
  );
}
