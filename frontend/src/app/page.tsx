import type { Metadata } from "next";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";
import { getGeneral } from "@/lib/site-content/general";
import { TopBar } from "@/components/layout/top-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { HomeRenderer } from "@/components/home/home-renderer";
import { getHomeBlocks } from "@/lib/home-blocks";
import { getTopBar, getMegaMenu, getFooter } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { siteName, siteTagline, ogImageUrl } = await getGeneral();
  const title = `${siteName} — ${siteTagline}`;
  const ogImage = ogImageUrl || `${SITE_URL}/og-image.jpg`;
  return {
    title,
    description: SITE_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      title,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      siteName,
      locale: "vi_VN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
  };
}

const FALLBACK_TOPBAR = { messages: [] };
const FALLBACK_MEGAMENU = { items: [] };
const FALLBACK_FOOTER = {
  columns: [],
  socials: [],
  legal: { copyright: "" },
};
const FALLBACK_HOME_BLOCKS = {
  blocks: [],
  aggregated: {
    banners: [],
    featuredCategories: [],
    latestProducts: [],
    featuredProducts: [],
    faqItemsBySlug: {},
    highlightedReviews: [],
  },
};

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default async function HomePage() {
  const [topBarR, megamenuR, footerR, homeBlocksR] = await Promise.allSettled([
    getTopBar(),
    getMegaMenu(),
    getFooter(),
    getHomeBlocks(),
  ]);

  const topBar = unwrap(topBarR, FALLBACK_TOPBAR);
  const megamenu = unwrap(megamenuR, FALLBACK_MEGAMENU);
  const footer = unwrap(footerR, FALLBACK_FOOTER);
  const homeBlocks = unwrap(homeBlocksR, FALLBACK_HOME_BLOCKS);

  return (
    <>
      <TopBar messages={topBar.messages} />
      <Header megamenu={megamenu.items} />
      <main className="flex-1 pb-16 lg:pb-0">
        <HomeRenderer payload={homeBlocks} />
      </main>
      <Footer
        columns={footer.columns}
        socials={footer.socials}
        legal={footer.legal}
      />
      <BottomNav />
    </>
  );
}
