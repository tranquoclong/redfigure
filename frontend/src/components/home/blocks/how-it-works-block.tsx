import type { HowItWorksData } from '@/lib/home-blocks';
import { SectionHead } from './_section-head';

interface Props {
  data: HowItWorksData;
}

export function HowItWorksBlock({ data }: Props) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <SectionHead eyebrow={data.eyebrow} title={data.title} />
      <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
        {data.steps.map((step) => (
          <div
            key={step.number + step.title}
            className="relative overflow-hidden rounded-2xl border border-white/8 px-6 py-7"
            style={{ background: 'linear-gradient(180deg, #160830, #0a0220)' }}
          >
            <div
              className="font-display text-[64px] font-black leading-none"
              style={{
                color: 'transparent',
                WebkitTextStroke: '1px var(--color-cyan, #00f0ff)',
              }}
            >
              {step.number}
            </div>
            <div className="mt-2 font-display text-sm font-bold uppercase tracking-[0.1em] text-white">
              {step.title}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
