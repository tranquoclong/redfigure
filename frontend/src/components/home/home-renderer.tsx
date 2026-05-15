import type { HomeBlocksResponse } from '@/lib/home-blocks';
import { CategoriesStripBlock } from './blocks/categories-strip-block';
import { CustomQuoteBlock } from './blocks/custom-quote-block';
import { FaqBlock } from './blocks/faq-block';
import { FeaturedProductsBlock } from './blocks/featured-products-block';
import { HeroCarouselBlock } from './blocks/hero-carousel-block';
import { HowItWorksBlock } from './blocks/how-it-works-block';
import { LatestProductsBlock } from './blocks/latest-products-block';
import { NewsletterBlock } from './blocks/newsletter-block';
import { PromoBannerBlock } from './blocks/promo-banner-block';
import { ReviewsBlock } from './blocks/reviews-block';
import { TrustStripBlock } from './blocks/trust-strip-block';

interface Props {
  payload: HomeBlocksResponse;
}

export function HomeRenderer({ payload }: Props) {
  const { blocks, aggregated } = payload;
  const active = blocks
    .filter((b) => b.isActive)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {active.map((block) => {

        switch (block.type) {
          case 'hero-carousel':
            return (
              <HeroCarouselBlock
                key={block.id}
                data={block.data}
                banners={aggregated.banners}
              />
            );
          case 'categories-strip':
            return (
              <CategoriesStripBlock
                key={block.id}
                data={block.data}
                categories={aggregated.featuredCategories}
              />
            );
          case 'latest-products':
            return (
              <LatestProductsBlock
                key={block.id}
                data={block.data}
                products={aggregated.latestProducts}
              />
            );
          case 'featured-products':
            return (
              <FeaturedProductsBlock
                key={block.id}
                data={block.data}
                products={aggregated.featuredProducts}
              />
            );
          case 'promo-banner':
            return <PromoBannerBlock key={block.id} data={block.data} />;
          case 'how-it-works':
            return <HowItWorksBlock key={block.id} data={block.data} />;
          case 'reviews':
            return (
              <ReviewsBlock
                key={block.id}
                data={block.data}
                reviews={aggregated.highlightedReviews}
              />
            );
          case 'faq': {
            const items = aggregated.faqItemsBySlug[block.data.pageSlug] ?? [];
            return <FaqBlock key={block.id} data={block.data} items={items} />;
          }
          case 'custom-quote':
            return <CustomQuoteBlock key={block.id} data={block.data} />;
          case 'newsletter':
            return <NewsletterBlock key={block.id} data={block.data} />;
          case 'trust-strip':
            return <TrustStripBlock key={block.id} data={block.data} />;
          default:

            return null;
        }
      })}
    </>
  );
}
