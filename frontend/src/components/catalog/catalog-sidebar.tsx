import type { ReactNode } from 'react';

interface CatalogSidebarProps {
  children: ReactNode;
}

export function CatalogSidebar({ children }: CatalogSidebarProps) {
  return (
    <aside
      data-testid="catalog-sidebar"
      className="hidden w-[280px] shrink-0 lg:block"
    >
      <div className="rounded-2xl border border-purple/20 bg-white/[0.02] p-5">
        {children}
      </div>
    </aside>
  );
}
