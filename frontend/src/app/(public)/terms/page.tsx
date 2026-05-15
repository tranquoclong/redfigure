import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";
import { SafeHtml } from "@/components/ui/safe-html";

async function getPage() {
  try {
    const { data } = await api.get("/pages/terms");
    return data.data ?? data;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  if (!page) return { title: "Điều khoản sử dụng" };
  return buildPageMetadata({
    title: page.metaTitle || page.title,
    description: page.metaDescription ?? "Điều khoản sử dụng của Red Figure.",
    path: "/terms",
  });
}

export default async function TermsPage() {
  const page = await getPage();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-wide text-white">
        {page?.title ?? "Điều khoản sử dụng"}
      </h1>
      <div className="h-1 w-20 bg-gradient-to-r from-magenta to-cyan rounded-full mb-10" />
      {page?.content ? (
        <SafeHtml className="prose-elite" html={page.content} />
      ) : (
        <p className="text-white/60">Nội dung sớm có.</p>
      )}
    </div>
  );
}
