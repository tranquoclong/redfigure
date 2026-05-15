import type { ApiRecord } from "@/types/api";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api-client";
import { formatDateLong } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Hướng dẫn và tin tức về mô hình, hội họa và sưu tập. Học hỏi kỹ thuật và khám phá các sản phẩm mới.",
  alternates: { canonical: "/blog" },
};

async function getPosts() {
  try {
    const { data } = await api.get("/blog", { params: { perPage: 20 } });
    return data;
  } catch {
    return { data: [], meta: { total: 0 } };
  }
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan">
          {"// blog"}
        </div>
        <h1 className="mt-2 text-4xl md:text-5xl text-white [font-family:var(--font-orbitron)]">
          BLOG
        </h1>
        <p className="mt-3 text-white/60">
          Hướng dẫn và tin tức về mô hình, hội họa và sưu tập. Học hỏi kỹ thuật
          và khám phá các sản phẩm mới.
        </p>
      </div>

      {posts.data.length === 0 ? (
        <p className="text-white/50">Không có bài viết.</p>
      ) : (
        <div className="space-y-10">
          {posts.data.map((post: ApiRecord) => (
            <article
              key={post.id}
              className="group rounded-2xl border border-purple/20 bg-white/[0.02] p-5 transition-colors hover:border-cyan/50 md:p-6"
            >
              <Link href={`/blog/${post.slug}`}>
                {post.coverImage && (
                  <div className="relative mb-5 aspect-[2/1] overflow-hidden rounded-xl">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 768px"
                    />
                  </div>
                )}
                <p className="text-xs uppercase tracking-wider text-cyan/70 [font-family:var(--font-orbitron)]">
                  {post.publishedAt ? formatDateLong(post.publishedAt) : ""}
                </p>
                <h2 className="mt-2 text-2xl text-white transition-colors group-hover:text-cyan [font-family:var(--font-orbitron)]">
                  {post.title}
                </h2>
              </Link>
              {post.excerpt && (
                <p className="mt-3 text-white/70 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 inline-block text-sm text-cyan hover:underline"
              >
                Đọc tiếp →
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
