import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function QuoteThankYouPage() {
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-cyan/10 text-cyan mb-6">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-3xl md:text-4xl font-black mb-3 [font-family:var(--font-orbitron)] text-white">
        Đã nhận yêu cầu báo giá!
      </h1>
      <p className="text-white/80 mb-8">
        Đã nhận được yêu cầu báo giá. Chúng tôi sẽ đánh giá chi tiết và gửi báo
        giá qua email cùng với một liên kết độc quyền để bạn chấp nhận các sản
        phẩm mà bạn quan tâm.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/">
          <Button variant="outline">Quay lại trang chủ</Button>
        </Link>
        <Link href="/products">
          <Button variant="neon">Xem sản phẩm</Button>
        </Link>
      </div>
    </div>
  );
}
