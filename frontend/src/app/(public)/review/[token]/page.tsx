import { api } from "@/lib/api-client";
import type { Metadata } from "next";
import { ReviewForm } from "./review-form";
import { ReviewError } from "./review-error";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đánh giá sản phẩm · RedFigure",
  robots: { index: false, follow: false },
};

interface InviteProduct {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    images?: Array<{
      mediaFile?: { card?: string; full?: string } | null;
    }> | null;
  };
  variationId: string | null;
  variation: { id: string; name: string } | null;
}

interface InviteData {
  invite: {
    id: string;
    token: string;
    tokenExpiresAt: string;
    submittedAt: string | null;
  };
  order: {
    id: string;
    number: string;
    customerName: string | null;
    items: InviteProduct[];
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

async function fetchInvite(
  token: string,
): Promise<
  | { ok: true; data: InviteData }
  | { ok: false; status: number; message: string }
> {
  try {
    const { data } = await api.get(`/review-invites/${token}`);
    return { ok: true, data: (data.data ?? data) as InviteData };
  } catch (err) {
    const resp = (
      err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      }
    )?.response;
    return {
      ok: false,
      status: resp?.status ?? 500,
      message: resp?.data?.error?.message ?? "Không thể tải link đánh giá.",
    };
  }
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await fetchInvite(token);

  if (!result.ok) {
    return <ReviewError message={result.message} status={result.status} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <ReviewForm data={result.data} token={token} />
    </div>
  );
}
