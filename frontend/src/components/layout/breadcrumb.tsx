import Link from 'next/link';
import { Fragment } from 'react';

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={`mb-3 text-[11px] uppercase tracking-[0.08em] [font-family:var(--font-mono)] text-white/40 ${className ?? ''}`}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <Fragment key={`${item.name}-${idx}`}>
              {idx > 0 && (
                <span aria-hidden className="text-white/20">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-cyan"
                >
                  {item.name}
                </Link>
              ) : (
                <span className={isLast ? 'text-cyan' : 'text-white/40'}>
                  {item.name}
                </span>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
