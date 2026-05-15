import type { TopBarMessage } from "@/lib/site-content";

export interface TopBarProps {
  messages: TopBarMessage[];
}

export function TopBar({ messages }: TopBarProps) {
  if (messages.length === 0) return null;

  const ordered = [...messages].sort((a, b) => {
    if (a.align === b.align) return 0;
    return a.align === "left" ? -1 : 1;
  });

  return (
    <div
      className="overflow-hidden border-b border-white/[0.06] bg-[#03000a] py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] text-white/70"
      role="region"
      aria-label="Thông báo cửa hàng"
    >
      <div className="animate-marquee flex gap-14 whitespace-nowrap">
        {[...ordered, ...ordered].map((msg, idx) => (
          <span
            key={`${msg.text}-${idx}`}
            className="inline-flex shrink-0 items-center gap-2"
          >
            {renderHighlightedText(msg.text)}
          </span>
        ))}
      </div>
    </div>
  );
}

function renderHighlightedText(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|~[^~]+~)/g).filter(Boolean);
  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-magenta">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("~") && tok.endsWith("~")) {
      return (
        <span key={i} className="text-cyan">
          {tok.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{tok}</span>;
  });
}
