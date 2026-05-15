import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { data } = await api.get("/pages/contact");
    const page = data.data ?? data;
    return buildPageMetadata({
      title: page.metaTitle || page.title || "Liên hệ",
      description: page.metaDescription ?? "Liên hệ với Red Figure.",
      path: "/contact",
      image: page.ogImage,
    });
  } catch {
    return { title: "Liên hệ" };
  }
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
