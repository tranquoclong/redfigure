import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateLong, SITE_URL } from "@/lib/constants";
import { buildPageMetadata } from "@/lib/seo";
import { getGeneral } from "@/lib/site-content/general";
import { EmptyState } from "@/components/shared/empty-state";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { buildBlogPostingSchema } from "@/components/seo/schemas";
import { SafeHtml } from "@/components/ui/safe-html";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ data }, general] = await Promise.all([
      api.get(`/blog/${slug}`),
      getGeneral(),
    ]);
    const post = data.data;
    return buildPageMetadata({
      title: post.title,
      description: post.excerpt ?? post.title,
      path: `/blog/${post.slug}`,
      image: post.coverImage,
      fallbackImage: general.ogImageUrl,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    });
  } catch {
    return { title: "Post" };
  }
}

async function getPost(slug: string) {
  try {
    const { data } = await api.get(`/blog/${slug}`);
    return data.data;
  } catch {
    return null;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title="Không tìm thấy bài viết"
          description="Bài viết không tồn tại."
        />
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbSchema
        items={[
          { name: "Trang chủ", url: SITE_URL },
          { name: "Blog", url: `${SITE_URL}/blog` },
          { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
        ]}
      />
      <JsonLdScript
        data={buildBlogPostingSchema({
          siteUrl: SITE_URL,
          title: post.title,
          description: post.excerpt ?? post.title,
          url: `${SITE_URL}/blog/${post.slug}`,
          image: post.coverImage,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          authorName: post.author?.name,
        })}
      />
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay về blog
      </Link>

      {post.coverImage && (
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg mb-8 bg-muted">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      <h1 className="text-3xl sm:text-4xl font-bold mb-4">{post.title}</h1>

      <p className="text-sm text-muted-foreground mb-8">
        {post.publishedAt ? formatDateLong(post.publishedAt) : ""}
      </p>

      <SafeHtml className="prose prose-lg max-w-none" html={post.content} />
    </article>
  );
}
