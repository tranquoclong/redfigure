import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 600px at 50% 30%, rgba(255,0,122,0.15), transparent 60%), radial-gradient(700px 500px at 50% 80%, rgba(0,240,255,0.12), transparent 60%)",
        }}
      />
      <div className="relative">
        <Logo variant="icone" className="mx-auto h-24 w-24" />

        <div className="mt-8 [font-family:var(--font-orbitron)]">
          <div className="text-7xl md:text-9xl font-black leading-none text-white drop-shadow-[0_0_22px_rgba(184,41,255,0.7)]">
            404
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.4em] text-cyan">
            {"// Không tìm thấy"}
          </div>
        </div>

        <h1 className="mt-6 text-2xl text-white [font-family:var(--font-orbitron)]">
          404 - Trang không tìm thấy
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          {`Liên kết này có thể đã biến mất do lỗi hệ thống. Có thể sản phẩm đã
          được gỡ bỏ hoặc địa chỉ không chính xác. Quay lại danh mục sản phẩm
          để khám phá các tác phẩm điêu khắc khác.`}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={ROUTES.home}>
            <Button variant="neon" className="rounded-lg px-10 py-6">
              ← QUAY LẠI TRANG CHỦ
            </Button>
          </Link>
          <Link href={ROUTES.products}>
            <Button variant="ghost-neon" className="rounded-lg px-10 py-6">
              KHÁM PHÁ SẢN PHẨM
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
