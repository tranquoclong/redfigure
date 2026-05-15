import Link from "next/link";
import type { AggregatedFaqItem, FaqData } from "@/lib/home-blocks";
import { SectionHead } from "./_section-head";

interface Props {
  data: FaqData;
  items: AggregatedFaqItem[];
}

export function FaqBlock({ data, items }: Props) {
  const limit = data.limit ?? 6;
  const visible = items.slice(0, limit);

  if (visible.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <SectionHead
        eyebrow={data.eyebrow}
        title={data.title}
        more={{ label: "Xem thêm →", href: "/faq" }}
      />
      <div
        className="overflow-hidden rounded-2xl border bg-white/[0.02] backdrop-blur-sm"
        style={{ borderColor: "rgba(184,41,255,0.55)" }}
      >
        {visible.map((item, idx) => (
          <details
            key={idx}
            open={idx === 0}
            className="group border-b border-white/8 last:border-b-0"
          >
            <summary
              className={`flex cursor-pointer list-none items-center justify-between gap-4 px-7 py-5 font-sans text-[15px] font-semibold text-white group-open:text-cyan ${
                idx === 0 ? "text-cyan" : ""
              }`}
            >
              <span>{item.question}</span>
              <span
                aria-hidden
                className="text-magenta transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <FaqAnswer answer={item.answer} />
          </details>
        ))}
      </div>
    </section>
  );
}

function FaqAnswer({ answer }: { answer: string }) {
  const parts = answer.split(/(\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*)/g);
  return (
    <div className="px-7 pb-6 pt-0 text-[14px] leading-relaxed text-white/72">
      {parts.map((part, i) => {
        if (
          part.startsWith("/") &&
          part.length > 1 &&
          /^\/[a-zA-Z]/.test(part)
        ) {
          return (
            <Link key={i} href={part} className="text-cyan hover:text-white">
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
