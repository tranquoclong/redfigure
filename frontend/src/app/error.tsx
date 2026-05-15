"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportError } from "@/lib/error-reporter";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(
      {
        type: "unhandled",
        message: error.message ?? "Unknown render error",

        url:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        timestamp: Date.now(),
      },
      error,
    );
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-3">Có lỗi xảy ra</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Chúng tôi gặp sự cố khi tải trang này. Nhóm của chúng tôi đã được thông
        báo. Bạn có thể thử lại hoặc quay lại trang chủ.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-md border text-sm font-medium"
        >
          Quay lại trang chủ
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-[10px] text-muted-foreground font-mono">
          lỗi: {error.digest}
        </p>
      )}
    </div>
  );
}
