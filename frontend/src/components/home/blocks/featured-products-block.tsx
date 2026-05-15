import type {
  AggregatedProduct,
  FeaturedProductsData,
} from '@/lib/home-blocks';
import { SectionHead } from './_section-head';
import { HomeProductCard } from './_home-product-card';

interface Props {
  data: FeaturedProductsData;
  products: AggregatedProduct[];
}

export function FeaturedProductsBlock({ data, products }: Props) {
  const items = products.slice(0, data.limit);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <SectionHead
        eyebrow={data.eyebrow}
        title={data.title}
        more={
          data.ctaLabel && data.ctaHref
            ? { label: data.ctaLabel, href: data.ctaHref }
            : undefined
        }
      />
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((product, idx) => {
          const onSale =
            !!product.salePrice &&
            product.salePrice > 0 &&
            product.salePrice < product.basePrice;
          const off = onSale
            ? Math.round(
                ((product.basePrice - (product.salePrice ?? 0)) /
                  product.basePrice) *
                  100,
              )
            : 0;
          const badge = onSale
            ? { label: `-${off}%`, variant: 'sale' as const }
            : idx < 3
              ? { label: 'Top', variant: 'top' as const }
              : undefined;
          return (
            <HomeProductCard
              key={product.id}
              product={product}
              badge={badge}
            />
          );
        })}
      </div>
    </section>
  );
}
