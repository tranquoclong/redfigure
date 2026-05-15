"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporter";

export default function GlobalError({
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
        message: error.message ?? "Unknown root render error",
        url:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        timestamp: Date.now(),
      },
      error,
    );
  }, [error]);

  return (
    <html lang="vi-VN">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          background: "#06010f",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "0.75rem",
          }}
        >
          Đã có lỗi xảy ra
        </h1>
        <p
          style={{
            maxWidth: 480,
            opacity: 0.7,
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
          }}
        >
          Không tìm thấy lỗi. Vui lòng thử lại sau.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.5rem 1rem",
            background: "#ff007a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Tải lại trang
        </button>
        {error.digest && (
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "0.625rem",
              opacity: 0.5,
              fontFamily: "monospace",
            }}
          >
            lỗi: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
