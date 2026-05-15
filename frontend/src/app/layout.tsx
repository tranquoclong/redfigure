import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Orbitron, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "./providers";
import { OrganizationSchema } from "@/components/seo/OrganizationSchema";
import { WebSiteSchema } from "@/components/seo/WebSiteSchema";
import { MetaPixelScript } from "@/components/analytics/MetaPixelScript";
import { WebVitalsReporter } from "@/components/analytics/WebVitalsReporter";
import { AffiliateTracker } from "@/components/affiliate-tracker";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";
import { getGeneral } from "@/lib/site-content/general";
import "./globals.css";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const general = await getGeneral();
  const siteName = general.siteName;
  const defaultTitle = `${siteName} — ${general.siteTagline}`;
  const ogImage = general.ogImageUrl || "/og-image.jpg";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: defaultTitle,
      template: `%s | ${siteName}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: siteName,
    alternates: { canonical: "/" },
    icons: {
      icon: [
        { url: "/favicon-192.png", type: "image/png" },
        { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName,
      title: defaultTitle,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { siteName } = await getGeneral();
  return (
    <html
      lang="vi-VN"
      className={`${inter.variable} ${orbitron.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col [font-family:var(--font-inter)] bg-ink text-white">
        <OrganizationSchema
          siteUrl={SITE_URL}
          name={siteName}
          logoUrl={`${SITE_URL}/logo.png`}
          description="Red Figure là cửa hàng chuyên cung cấp các mô hình phong cách anime và figure sưu tập, được in bằng công nghệ resin độ phân giải cao dành cho người yêu thích nghệ thuật và sưu tầm."
        />
        <WebSiteSchema siteUrl={SITE_URL} name={siteName} />

        <Suspense fallback={null}>
          <AffiliateTracker />
        </Suspense>
        <Providers>{children}</Providers>
        {GA4_ID && <GoogleAnalytics gaId={GA4_ID} />}
        {META_PIXEL_ID && <MetaPixelScript pixelId={META_PIXEL_ID} />}
        <WebVitalsReporter />
      </body>
    </html>
  );
}
