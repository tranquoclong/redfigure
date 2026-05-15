import { TopBar } from '@/components/layout/top-bar';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { BottomNav } from '@/components/layout/bottom-nav';
import { RecentlyViewedSection } from '@/components/product/recently-viewed-section';
import { getTopBar, getMegaMenu, getFooter } from '@/lib/site-content';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [topBar, megamenu, footer] = await Promise.all([
    getTopBar(),
    getMegaMenu(),
    getFooter(),
  ]);
  return (
    <>
      <TopBar messages={topBar.messages} />
      <Header megamenu={megamenu.items} />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <RecentlyViewedSection />
      <Footer
        columns={footer.columns}
        socials={footer.socials}
        legal={footer.legal}
      />
      <BottomNav />
    </>
  );
}
