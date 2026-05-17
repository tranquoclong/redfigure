import Link from "next/link";
import { Check, AlertCircle, Clock } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const COPY = {
  success: {
    icon: Check,
    iconClass: "text-lime",
    title: "Đã xác nhận đăng ký!",
    body: "Bạn đã chính thức có trong danh sách của RedFigure. Từ giờ bạn sẽ nhận được tin tức về các sản phẩm mới, các chương trình khuyến mãi độc quyền và các đợt phát hành từ các studio yêu thích.",
  },
  already: {
    icon: Check,
    iconClass: "text-cyan",
    title: "Đã xác nhận đăng ký!",
    body: "Bạn đã có trong danh sách của chúng tôi. Bạn có thể đóng cửa sổ này — bạn sẽ tiếp tục nhận được tin tức của chúng tôi.",
  },
  expired: {
    icon: Clock,
    iconClass: "text-amber-300",
    title: "Link hết hạn",
    body: "Link xác nhận chỉ có hiệu lực trong 7 ngày. Quay lại trang chủ và đăng ký lại email của bạn — chúng tôi sẽ gửi cho bạn một link mới.",
  },
  invalid: {
    icon: AlertCircle,
    iconClass: "text-magenta",
    title: "Link không hợp lệ",
    body: "Link này không tương ứng với bất kỳ đăng ký nào đang chờ xử lý. Nếu bạn vừa nhận được, hãy thử nhấp lại trực tiếp từ email — một số trình khách email ghi đè URLs.",
  },
} as const;

type Status = keyof typeof COPY;

function isValidStatus(s: string | undefined): s is Status {
  return (
    s === "success" || s === "already" || s === "expired" || s === "invalid"
  );
}

export const metadata = {
  title: "Xác nhận đăng ký · RedFigure",
  robots: { index: false, follow: false },
};

export default async function NewsletterConfirmadoPage({
  searchParams,
}: PageProps) {
  const { status } = await searchParams;
  const key: Status = isValidStatus(status) ? status : "invalid";
  const { icon: Icon, iconClass, title, body } = COPY[key];

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={`mb-6 flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] ${iconClass}`}
        aria-hidden
      >
        <Icon className="size-8" strokeWidth={2} />
      </div>
      <h1 className="mb-3 font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      <p className="mb-8 text-sm leading-relaxed text-white/70 sm:text-base">
        {body}
      </p>
      <Link
        href="/"
        className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-purple to-magenta px-6 font-display text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-110"
      >
        Quay lại trang chủ
      </Link>
    </main>
  );
}
