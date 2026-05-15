import { Truck, ShieldCheck, Tag, Lock } from "lucide-react";
import type { TrustBadgeIcon, TrustStripData } from "@/lib/home-blocks";

const ICON_MAP: Record<
  TrustBadgeIcon,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  shipping: Truck,
  shield: ShieldCheck,
  discount: Tag,
  age: Lock,
};

interface Props {
  data: TrustStripData;
}

export function TrustStripBlock({ data }: Props) {
  const badges = data.badges.slice(0, 4);
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 divide-x divide-y divide-white/8 border border-white/8 md:grid-cols-4 md:divide-y-0">
        {badges.map((badge) => {
          const Icon = ICON_MAP[badge.icon] ?? Truck;
          return (
            <div key={badge.icon + badge.title} className="px-6 py-7">
              <Icon className="size-[22px] text-cyan" strokeWidth={2} />
              <h4 className="mt-3 text-sm font-bold uppercase tracking-[0.1em] text-white">
                {badge.title}
              </h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
                {badge.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
