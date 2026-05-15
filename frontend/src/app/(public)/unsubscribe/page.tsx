"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, MailX } from "lucide-react";
import { api } from "@/lib/api-client";

import { extractApiError } from "@/lib/extract-error";
type Status = "idle" | "loading" | "success" | "error";

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan" />
        </div>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  );
}

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";

  const [status, setStatus] = useState<Status>(token ? "idle" : "error");
  const [message, setMessage] = useState(
    token
      ? ""
      : "Link không hợp lệ — không tìm thấy token. Vui lòng sử dụng liên kết đã gửi qua email.",
  );

  async function confirm() {
    if (!token || status !== "idle") return;
    setStatus("loading");
    try {
      await api.post("/users/unsubscribe", { token });
      setStatus("success");
      setMessage(
        "Xong! Bạn sẽ không nhận được email quảng cáo nữa. Nếu đổi ý, chỉ cần kích hoạt lại.",
      );
    } catch (err) {
      setStatus("error");
      setMessage(
        extractApiError(
          err,
          "Không thể xử lý yêu cầu hủy đăng ký. Liên kết có thể đã hết hạn.",
        ),
      );
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6 rounded-2xl border border-purple/20 bg-black/40 p-8 backdrop-blur">
        {status === "idle" && (
          <>
            <MailX className="h-12 w-12 mx-auto text-cyan" />
            <h1 className="text-xl font-semibold text-white [font-family:var(--font-orbitron)]">
              Xác nhận hủy đăng ký
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">
              Nhấn dưới đây để ngừng nhận email quảng cáo (đánh giá sản phẩm,
              nhắc nhở giỏ hàng, ưu đãi). Email đơn hàng vẫn sẽ được gửi bình
              thường.
            </p>
            <button
              onClick={confirm}
              disabled={status !== "idle"}
              className="rounded-full bg-magenta/80 hover:bg-magenta px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xác nhận
            </button>
          </>
        )}
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-cyan" />
            <h1 className="text-xl font-semibold text-white [font-family:var(--font-orbitron)]">
              Đang xử lý...
            </h1>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-400" />
            <h1 className="text-xl font-semibold text-white [font-family:var(--font-orbitron)]">
              Hủy đăng ký thành công
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-12 w-12 mx-auto text-magenta" />
            <h1 className="text-xl font-semibold text-white [font-family:var(--font-orbitron)]">
              Có lỗi xảy ra
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">{message}</p>
          </>
        )}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-block rounded-full border border-cyan/40 px-5 py-2 text-sm text-cyan hover:bg-cyan/10 transition-colors"
          >
            Quay về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
