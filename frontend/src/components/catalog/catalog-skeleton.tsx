interface CatalogSkeletonProps {
  count?: number;
  withSidebar?: boolean;
}

export function CatalogSkeleton({
  count = 12,
  withSidebar = true,
}: CatalogSkeletonProps) {
  return (
    <div data-testid="catalog-skeleton" className="flex gap-8">
      {withSidebar && (
        <aside aria-hidden className="hidden w-64 shrink-0 space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              data-testid="catalog-skeleton-bar"
              className="h-12 w-full animate-pulse rounded-lg bg-purple/10"
            />
          ))}
        </aside>
      )}
      <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            data-testid="catalog-skeleton-card"
            className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-purple/10"
          />
        ))}
      </div>
    </div>
  );
}
