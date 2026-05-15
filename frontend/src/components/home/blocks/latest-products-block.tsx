import type { AggregatedProduct, LatestProductsData } from "@/lib/home-blocks";
import { SectionHead } from "./_section-head";
import { HomeProductCard } from "./_home-product-card";

interface Props {
  data: LatestProductsData;
  products: AggregatedProduct[];
}

export function LatestProductsBlock({ data, products }: Props) {
  const items = products.slice(0, data.limit);
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-8 sm:py-10 sm:px-6 lg:px-8">
      <SectionHead
        eyebrow={data.eyebrow}
        title={data.title}
        more={{ label: "Xem thêm →", href: "/products?order=releases" }}
      />
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {items.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            badge={{ label: "Mới", variant: "new" }}
          />
        ))}
      </div>
    </section>
  );
}
