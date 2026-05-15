import type { Metadata } from "next";
import { api } from "@/lib/api-client";
import { buildPageMetadata } from "@/lib/seo";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buildFaqPageSchema } from "@/components/seo/schemas";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SITE_URL } from "@/lib/constants";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import { SafeHtml } from "@/components/ui/safe-html";

interface FaqItem {
  question: string;
  answer: string;
}

interface PageData {
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  faqItems?: FaqItem[];
}

async function getPage(): Promise<PageData | null> {
  try {
    const { data } = await api.get("/pages/faq");
    return data.data ?? data;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  if (!page) return { title: "FAQ" };
  return buildPageMetadata({
    title: page.metaTitle || page.title,
    description: page.metaDescription ?? "Câu hỏi thường gặp về mô hình.",
    path: "/faq",
    image: page.ogImage,
  });
}

export default async function FaqPage() {
  const page = await getPage();
  const faqs: FaqItem[] = (page?.faqItems as FaqItem[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "FAQ", url: `${SITE_URL}/faq` },
        ]}
      />
      {faqs.length > 0 && <JsonLdScript data={buildFaqPageSchema(faqs)} />}
      <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-wide text-white">
        {page?.title ?? "Câu hỏi thường gặp"}
      </h1>
      <div className="h-1 w-20 bg-gradient-to-r from-magenta to-cyan rounded-full mb-10" />
      {page?.content && (
        <SafeHtml className="prose-elite mb-10" html={page.content} />
      )}
      {faqs.length > 0 ? (
        <Accordion className="rounded-xl border border-white/10 bg-ink-soft/40 px-4 backdrop-blur-sm sm:px-6">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionPanel>
                <p className="whitespace-pre-wrap">{faq.answer}</p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="text-white/60 text-center py-8">Không có câu hỏi.</p>
      )}
    </div>
  );
}
