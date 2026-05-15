"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AxiosError } from "axios";
import * as Sentry from "@sentry/nextjs";
import { Plus, Trash2, Upload, X, User as UserIcon, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { formatPhone } from "@/lib/constants";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const MAX_IMAGES = 5;
const MAX_LINKS = 5;

const quoteSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().max(254).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  description: z
    .string()
    .trim()
    .min(10, "Vui lòng mô tả sản phẩm muốn in (tối thiểu 10 ký tự)")
    .max(5000),
  externalLinks: z
    .array(
      z.object({
        url: z.string().trim().url("Link không hợp lệ").or(z.literal("")),
      }),
    )
    .max(MAX_LINKS),
  acceptLgpd: z.literal(true, {
    message: "Vui lòng chấp nhận xử lý dữ liệu",
  }),
  website: z.string().max(200).optional(),
});

const anonymousQuoteSchema = quoteSchema.extend({
  name: z.string().trim().min(2, "Vui lòng nhập tên").max(120),
  email: z.string().trim().email("Email không hợp lệ").max(254),

  phone: z
    .string()
    .trim()
    .max(15, "Số điện thoại tối đa 15 ký tự")
    .optional()
    .or(z.literal("")),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

interface UploadedImage {
  id: string;
  thumb: string;
}

export default function QuotePage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const isLogged = isHydrated && isAuthenticated && user != null;

  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(isLogged ? quoteSchema : anonymousQuoteSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      description: "",
      externalLinks: [{ url: "" }],
      acceptLgpd: false as unknown as true,
      website: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "externalLinks",
  });

  const [turnstileState, setTurnstileState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (!SITE_KEY) {
      Sentry.captureMessage("Thiếu khóa site key Turnstile trên /quote", {
        level: "error",
      });
      setTurnstileState("error");
      return;
    }
    if (!turnstileLoaded) {
      setTurnstileState("loading");
      return;
    }
    if (!turnstileRef.current) return;
    if (widgetIdRef.current) return;

    try {
      const id = window.turnstile!.render(turnstileRef.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: (token: string) => {
          setTurnstileToken(token);
          setTurnstileState("ready");
        },
        "error-callback": (errorCode?: string) => {
          setTurnstileToken("");
          setTurnstileState("error");

          Sentry.captureMessage("Lỗi Turnstile", {
            level: "warning",
            extra: { errorCode, page: "/quote" },
          });
        },
        "expired-callback": () => {
          setTurnstileToken("");
          setTurnstileState("ready");
        },
      });
      widgetIdRef.current = id;
    } catch (renderErr) {
      setTurnstileState("error");
      Sentry.captureException(renderErr, {
        tags: { feature: "turnstile-render" },
        extra: { page: "/quote" },
      });
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [turnstileLoaded]);

  useEffect(() => {
    if (turnstileState !== "loading") return;
    const t = setTimeout(() => {
      if (turnstileState === "loading") {
        setTurnstileState("error");
        Sentry.captureMessage("Lỗi Turnstile (15s) - Script chưa tải", {
          level: "warning",
          extra: { page: "/quote", site_key_set: !!SITE_KEY },
        });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [turnstileState]);

  async function handleUpload(file: File) {
    if (uploadedImages.length >= MAX_IMAGES) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(
        "/custom-quotes/request/upload-image",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const media = data.data;
      if (media?.id && media?.thumb) {
        setUploadedImages((prev) => [
          ...prev,
          { id: media.id, thumb: media.thumb },
        ]);
      }
    } catch {
    } finally {
      setUploading(false);
    }
  }

  const onSubmit = async (values: QuoteFormValues) => {
    if (!SITE_KEY) {
      setSubmitStatus({
        kind: "error",
        message: "Vui lòng thử lại sau.",
      });
      return;
    }
    if (!turnstileToken) {
      setSubmitStatus({
        kind: "error",
        message: "Vui lòng đợi xác minh.",
      });
      return;
    }

    setSubmitStatus({ kind: "submitting" });
    try {
      await api.post("/custom-quotes/request", {
        name: isLogged ? undefined : values.name,
        email: isLogged ? undefined : values.email,
        phone: isLogged ? undefined : values.phone || undefined,
        description: values.description,
        externalLinks: values.externalLinks
          .map((l) => l.url.trim())
          .filter((url) => url.length > 0),
        imageMediaFileIds: uploadedImages.map((i) => i.id),
        acceptLgpd: values.acceptLgpd,
        turnstileToken,
        website: values.website ?? "",
      });
      router.push("/quote/thank-you");
    } catch (err) {
      const message =
        (err instanceof AxiosError &&
          (err.response?.data as { error?: { message?: string } } | undefined)
            ?.error?.message) ||
        "Không thể gửi yêu cầu. Vui lòng thử lại sau.";
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
        Yêu cầu báo giá
      </h1>
      <div className="h-1 w-20 bg-gradient-to-r from-magenta to-cyan rounded-full mb-10" />

      <div className="prose-elite mb-10">
        <p>
          Bạn có một mô hình muốn in? Hãy gửi cho chúng tôi những gì bạn có (ảnh
          hoặc liên kết Google Drive chứa file ảnh) và chúng tôi sẽ báo giá cho
          bạn.
        </p>
        <p>
          Bạn sẽ nhận được báo giá qua email với một liên kết độc quyền — bạn có
          thể chọn các sản phẩm muốn mua và hoàn tất đơn hàng cùng với các sản
          phẩm khác trong cửa hàng.
        </p>
      </div>

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
          <label htmlFor="quote-website">
            Không điền vào trường này (chỉ dành cho robot):
          </label>
          <input
            {...register("website")}
            id="quote-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {isLogged ? (
          <div className="rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-3 flex items-start gap-3">
            <UserIcon className="h-5 w-5 text-cyan shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-white">
                Yêu cầu với tư cách{" "}
                <span className="font-semibold text-cyan">{user.name}</span>
              </p>
              <p className="text-white/60 text-xs mt-1">
                {user.email}
                {" · "}
                <Link
                  href="/my-account/profile"
                  className="underline hover:text-cyan"
                >
                  Cập nhật dữ liệu
                </Link>
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-purple/30 bg-purple/5 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 text-sm">
                <LogIn className="h-5 w-5 text-purple shrink-0 mt-0.5" />
                <div>
                  <p className="text-white">Bạn đã là khách hàng?</p>
                  <p className="text-white/60 text-xs mt-1">
                    Đăng nhập để điền thông tin tự động và theo dõi báo giá
                    trong tài khoản của bạn.
                  </p>
                </div>
              </div>
              <Link
                href={`/login?returnTo=${encodeURIComponent("/quote")}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-purple/20 hover:bg-purple/30 text-purple px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" />
                Đăng nhập
              </Link>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
                >
                  Tên
                </Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Tên của bạn"
                />
                {errors.name && (
                  <p className="text-xs text-magenta">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="user@gmail.com"
                />
                {errors.email && (
                  <p className="text-xs text-magenta">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="phone"
                className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
              >
                Điện thoại (tùy chọn)
              </Label>
              <Input
                id="phone"
                {...register("phone", {
                  onChange: (e) => {
                    e.target.value = formatPhone(e.target.value);
                  },
                })}
                maxLength={15}
                inputMode="tel"
                placeholder="Số điện thoại"
              />
              {errors.phone && (
                <p className="text-xs text-magenta">{errors.phone.message}</p>
              )}
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]"
          >
            Mô tả sản phẩm bạn muốn in
          </Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Ví dụ: tôi muốn in mô hình Hulk size 32mm, chất lượng cao..."
            rows={5}
          />
          {errors.description && (
            <p className="text-xs text-magenta">{errors.description.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]">
            Liên kết (Dropbox, Google Drive…)
          </Label>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <Input
                {...register(`externalLinks.${idx}.url`)}
                placeholder="https://..."
              />
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(idx)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {fields.length < MAX_LINKS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ url: "" })}
            >
              <Plus className="h-4 w-4 mr-1" /> Thêm link
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm uppercase tracking-wider text-cyan/80 [font-family:var(--font-orbitron)]">
            Hình ảnh (tùy chọn, tối đa {MAX_IMAGES})
          </Label>
          <div className="flex flex-wrap gap-3">
            {uploadedImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.thumb}
                  alt=""
                  className="w-20 h-20 object-cover rounded-md border border-white/10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setUploadedImages((prev) =>
                      prev.filter((i) => i.id !== img.id),
                    )
                  }
                  className="absolute -top-2 -right-2 bg-destructive text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploadedImages.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 border-2 border-dashed border-white/20 rounded-md flex flex-col items-center justify-center gap-1 text-white/50 hover:border-cyan/50 hover:text-cyan transition disabled:opacity-50"
              >
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">
                  {uploading ? "Đang tải lên..." : "Tải lên"}
                </span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register("acceptLgpd")}
              className="mt-1"
            />
            <span className="text-sm text-white/80">
              Đồng ý với việc xử lý dữ liệu theo{" "}
              <Link href="/privacy" className="text-cyan underline">
                Chính sách quyền riêng tư
              </Link>
              .
            </span>
          </label>
          {errors.acceptLgpd && (
            <p className="text-xs text-magenta">{errors.acceptLgpd.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div ref={turnstileRef} />
          {turnstileState === "loading" && (
            <p className="text-xs text-white/50">Đang tải xác minh bảo mật…</p>
          )}
          {turnstileState === "error" && (
            <p className="text-xs text-amber-400">
              Không thể tải xác minh bảo mật. Tải lại trang hoặc tắt trình chặn
              quảng cáo và thử lại.
            </p>
          )}
        </div>

        {submitStatus.kind === "error" && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/40 px-4 py-3 text-sm text-destructive"
          >
            {submitStatus.message}
          </div>
        )}

        <Button
          type="submit"
          variant="neon"
          size="lg"
          disabled={isSubmitting || submitStatus.kind === "submitting"}
          className="w-full"
        >
          {submitStatus.kind === "submitting"
            ? "Đang gửi..."
            : "Gửi yêu cầu báo giá"}
        </Button>
      </form>
    </div>
  );
}
