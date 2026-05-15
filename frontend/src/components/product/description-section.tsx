import { SafeHtml } from "@/components/ui/safe-html";

export interface DescSidebarRow {
  key: string;
  value: string;

  cyan?: boolean;

  hot?: boolean;
}

export interface DescriptionSectionProps {
  html?: string | null;
  productionDays?: number;

  sidebar: DescSidebarRow[];
}

export function DescriptionSection({
  html,
  productionDays,
  sidebar,
}: DescriptionSectionProps) {
  if (!html && sidebar.length === 0) return null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
      <div>
        <h2 className="mb-4 font-display text-xl font-extrabold text-white">
          Thông tin sản phẩm
        </h2>
        {html && (
          <SafeHtml
            className="prose prose-sm prose-invert max-w-none text-white/70 [&_b]:text-white [&_b]:font-semibold [&_p]:leading-relaxed"
            html={html}
          />
        )}
        {productionDays != null && productionDays > 0 && (
          <p className="mt-6 border-t border-white/10 pt-4 text-sm text-white/55">
            Sản phẩm được sản xuất theo yêu cầu. Thời gian sản xuất:{" "}
            <b className="font-semibold text-cyan">
              {productionDays} ngày làm việc
            </b>{" "}
            trước khi giao hàng.
          </p>
        )}
      </div>

      {sidebar.length > 0 && (
        <aside className="self-start rounded-2xl border border-white/10 bg-white/[0.015] p-5 lg:sticky lg:top-32">
          <h3 className="mb-4 font-display text-xs font-bold uppercase tracking-widest text-white">
            Thông tin sản phẩm
          </h3>
          <dl className="flex flex-col">
            {sidebar.map((row, idx) => (
              <div
                key={`${row.key}-${idx}`}
                className={`flex justify-between gap-4 py-2 text-sm ${
                  idx < sidebar.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <dt className="text-white/55">{row.key}</dt>
                <dd
                  className={
                    row.cyan
                      ? "text-right font-mono text-xs uppercase tracking-wider text-cyan"
                      : row.hot
                        ? "text-right font-medium text-magenta"
                        : "text-right font-medium text-white"
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      )}
    </div>
  );
}
