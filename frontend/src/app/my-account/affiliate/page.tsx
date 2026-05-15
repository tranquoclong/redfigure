"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { AffiliateOverviewCard } from "@/components/affiliate-overview-card";
import { AffiliateVisitsList } from "@/components/affiliate-visits-list";
import { AffiliateCommissionsList } from "@/components/affiliate-commissions-list";
import { AffiliateLedgerList } from "@/components/affiliate-ledger-list";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface AffiliateAccount {
  id: string;
  publicId: number;
  publicCode: string | null;
  status: "APPROVED" | "SUSPENDED" | "REJECTED" | "PENDING";
  termsAcceptedAt: string;
  approvedAt: string | null;
  suspendedReason: string | null;
}

export default function AffiliatePage() {
  const queryClient = useQueryClient();
  const [optInOpen, setOptInOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["me", "affiliate"],
    queryFn: async () => {
      const { data } = await api.get<{ data: AffiliateAccount | null }>(
        "/me/affiliate",
      );
      return data.data;
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: AffiliateAccount }>(
        "/me/affiliate/apply",
        { acceptedTerms: true },
      );
      return data.data;
    },
    onSuccess: () => {
      setOptInOpen(false);
      setAcceptedTerms(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["me", "affiliate"] });
    },
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      setError(
        resp?.error?.message ??
          resp?.message ??
          "Lỗi khi tạo tài khoản liên kết.",
      );
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  if (!data) {
    return (
      <>
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-purple" />
            <h1 className="text-3xl font-bold">
              Chương trình tiếp thị liên kết
            </h1>
          </div>

          <div className="rounded-2xl border border-purple/25 bg-gradient-to-br from-purple/10 to-magenta/10 p-6 space-y-4">
            <h2 className="text-xl font-bold">
              Hãy chia sẻ link của bạn để nhận hoa hồng khi giới thiệu khách
              hàng
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Chia sẻ liên kết độc quyền của bạn trên mạng xã hội, nhóm Zalo,
              Discord hoặc bất cứ nơi nào bạn có khán giả. Mỗi lần bán hàng được
              tạo từ giới thiệu của bạn, bạn sẽ nhận được hoa hồng được ghi có
              vào bảng điều khiển của bạn. Rút tiền từ 100.000đ.
            </p>
            <ul className="text-sm space-y-2">
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-cyan flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Phê duyệt ngay lập tức</strong> - không cần chờ đợi,
                  bạn sẽ nhận được liên kết hoạt động ngay lập tức
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-cyan flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Hoa hồng chuẩn 5%</strong> trên giá trị của mặt hàng
                  (có thể thay đổi tùy theo sản phẩm/danh mục)
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="h-4 w-4 text-cyan flex-shrink-0 mt-0.5" />
                <span>
                  <strong>30 ngày gán quyền</strong> — khách truy cập mua hàng
                  trong vòng một tháng sau và bạn vẫn nhận được hoa hồng.
                </span>
              </li>
            </ul>
            <Button
              onClick={() => setOptInOpen(true)}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Award className="h-4 w-4 mr-2" />
              Tôi muốn trở thành tiếp thị liên kết
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Đọc các{" "}
            <Link href="/terms-affiliate" className="text-cyan hover:underline">
              điều khoản chương trình tiếp thị liên kết
            </Link>{" "}
            trước khi tham gia.
          </div>
        </div>

        <Dialog open={optInOpen} onOpenChange={setOptInOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tham gia chương trình tiếp thị liên kết</DialogTitle>
              <DialogDescription>
                Tham gia chương trình tiếp thị liên kết của chúng tôi để kiếm
                hoa hồng khi giới thiệu sản phẩm của chúng tôi cho bạn bè và
                người theo dõi của bạn.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 cursor-pointer"
                />
                <span className="text-sm">
                  Tôi đã đọc và chấp nhận{" "}
                  <Link
                    href="/terms-affiliate"
                    target="_blank"
                    className="text-cyan hover:underline inline-flex items-center gap-1"
                  >
                    điều khoản chương trình tiếp thị liên kết
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  , bao gồm các điều khoản và các chính sách chống gian lận.
                </span>
              </label>
              {error && (
                <div className="flex gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOptInOpen(false)}
                disabled={apply.isPending}
              >
                Hủy
              </Button>
              <Button
                onClick={() => apply.mutate()}
                disabled={!acceptedTerms || apply.isPending}
              >
                {apply.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Xác nhận tham gia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (data.status !== "APPROVED") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-amber-500" />
          <h1 className="text-3xl font-bold">Chương trình tiếp thị liên kết</h1>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-amber-500">
            Tài khoản {data.status.toLowerCase()}
          </h2>
          {data.status === "SUSPENDED" && data.suspendedReason && (
            <p className="text-sm text-white/80">
              <strong>Lý do:</strong> {data.suspendedReason}
            </p>
          )}
          <p className="text-sm text-white/70">
            Liên hệ với{" "}
            <Link href="/contact" className="text-cyan hover:underline">
              hỗ trợ
            </Link>{" "}
            nếu bạn tin rằng đây là một sự nhầm lẫn.
          </p>
        </div>
      </div>
    );
  }

  const refKey = data.publicCode ?? String(data.publicId);
  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${refKey}`
      : `/?ref=${refKey}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Award className="h-8 w-8 text-cyan" />
        <h1 className="text-3xl font-bold">
          Bảng điều khiển tiếp thị liên kết
        </h1>
      </div>

      <div className="rounded-2xl border border-cyan/25 bg-ink-soft p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Mã giới thiệu
            </p>
            <p className="text-2xl font-bold text-cyan">
              {data.publicCode ? data.publicCode : `#${data.publicId}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Trạng thái
            </p>
            <p className="text-lg font-semibold text-emerald-500">Đã duyệt</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Mã của bạn
          </p>
          <div className="flex gap-2">
            <code className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono truncate">
              {referralUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10 hover:border-cyan/50 hover:text-cyan"
              onClick={() => {
                void navigator.clipboard.writeText(referralUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Đã sao chép
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Sao chép
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sử dụng liên kết này trên mạng xã hội của bạn. Gán quyền có giá trị
            trong 30 ngày sau nhấp đầu tiên.
          </p>
        </div>
      </div>

      <AffiliateOverviewCard />

      <AffiliateCommissionsList endpoint="/me/affiliate/commissions" />

      <AffiliateLedgerList endpoint="/me/affiliate/ledger" />

      <AffiliateVisitsList endpoint="/me/affiliate/visits" />

      <div className="rounded-2xl border border-white/10 bg-ink-soft p-5 text-xs text-muted-foreground">
        <p>
          Có thắc mắc? Hãy xem{" "}
          <Link href="/terms-affiliate" className="text-cyan hover:underline">
            điều khoản chương trình tiếp thị liên kết
          </Link>
          . Các lượt truy cập chưa được chuyển đổi sẽ được lưu giữ trong 30
          ngày; các lượt truy cập đã được chuyển đổi sẽ được lưu trữ vĩnh viễn
          trong lịch sử.
        </p>
      </div>
    </div>
  );
}
