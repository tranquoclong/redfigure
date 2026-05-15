import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  status: number;
}

export function ReviewError({ message, status }: Props) {
  const title =
    status === 404
      ? "Liên kết không tìm thấy"
      : status === 400
        ? "Liên kết không khả dụng"
        : "Đã xảy ra lỗi";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold text-white [font-family:var(--font-orbitron)]">
        {title}
      </h1>
      <p className="mb-8 text-white/70">{message}</p>
      <Link href="/">
        <Button variant="neon">Quay về trang chủ</Button>
      </Link>
    </div>
  );
}
