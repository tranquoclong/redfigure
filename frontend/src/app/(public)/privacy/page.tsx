import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";
import { SafeHtml } from "@/components/ui/safe-html";

async function getPage() {
  try {
    const { data } = await api.get("/pages/privacy");
    return data.data ?? data;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  if (!page) return { title: "Chính sách bảo mật" };
  return buildPageMetadata({
    title: page.metaTitle || page.title,
    description: page.metaDescription ?? "Chính sách bảo mật của Red Figure.",
    path: "/privacy",
  });
}

export default async function PrivacyPage() {
  const page = await getPage();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-wide text-white">
        {page?.title ?? "Chính sách bảo mật"}
      </h1>
      <div className="h-1 w-20 bg-gradient-to-r from-magenta to-cyan rounded-full mb-10" />
      {page?.content ? (
        <SafeHtml className="prose-elite" html={page.content} />
      ) : (
        <p className="text-white/60">Chưa có nội dung.</p>
      )}
    </div>
  );
}
