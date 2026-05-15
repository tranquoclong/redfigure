"use client";

import Link from "next/link";
import {
  Handshake,
  Percent,
  DollarSign,
  Download,
  History,
  Users,
  FileText,
  UserPlus,
} from "lucide-react";
import { AffiliateDashboard } from "@/components/admin/affiliate-dashboard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

async function downloadCsv() {
  const response = await api.get("/admin/affiliates/export.csv", {
    responseType: "blob",
  });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `affiliates-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminAffiliatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Handshake className="h-8 w-8 text-cyan" />
          <div>
            <h1 className="text-3xl font-bold">Cộng tác viên</h1>
            <p className="text-sm text-muted-foreground">
              Hệ thống cộng tác viên — tự nguyện, hoa hồng, thanh toán.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void downloadCsv()}>
          <Download className="h-4 w-4 mr-2" />
          Xuất CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href="/admin/affiliate/list"
          className="rounded-2xl border border-cyan/25 bg-ink-soft p-4 hover:border-cyan/50 transition-colors flex items-start gap-3"
        >
          <Users className="h-5 w-5 text-cyan shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Danh sách CTV</h2>
            <p className="text-xs text-muted-foreground">
              Tìm kiếm + chi tiết: lượt giới thiệu, hoa hồng, sao kê, điều chỉnh
              số dư.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/affiliate/rules"
          className="rounded-2xl border border-purple/25 bg-ink-soft p-4 hover:border-cyan/50 transition-colors flex items-start gap-3"
        >
          <Percent className="h-5 w-5 text-purple shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Quy tắc hoa hồng</h2>
            <p className="text-xs text-muted-foreground">
              Sản phẩm &gt; Tag &gt; Danh mục &gt; Toàn cục. Mức 0 bị chặn.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/affiliate/payments"
          className="rounded-2xl border border-emerald-500/25 bg-ink-soft p-4 hover:border-cyan/50 transition-colors flex items-start gap-3"
        >
          <DollarSign className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Thanh toán</h2>
            <p className="text-xs text-muted-foreground">
              Yêu cầu đang chờ xử lý + ghi nhận thanh toán thủ công.
            </p>
          </div>
        </Link>

        <Link
          href="/admin/affiliate/historical-rate"
          className="rounded-2xl border border-cyan/25 bg-ink-soft p-4 hover:border-cyan/50 transition-colors flex items-start gap-3"
        >
          <History className="h-5 w-5 text-cyan shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Lịch sử quy tắc mặc định</h2>
            <p className="text-xs text-muted-foreground">
              Kiểm tra thay đổi mức hoa hồng mặc định (chống gian lận).
            </p>
          </div>
        </Link>

        <Link
          href="/admin/affiliate/new"
          className="rounded-2xl border border-magenta/25 bg-ink-soft p-4 hover:border-magenta/50 transition-colors flex items-start gap-3"
        >
          <UserPlus className="h-5 w-5 text-magenta shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Tạo CTV thủ công</h2>
            <p className="text-xs text-muted-foreground">
              Thăng cấp khách hàng hiện tại thành CTV — tận dụng đăng ký, không
              trùng lặp (AffiliateAccount.userId @unique).
            </p>
          </div>
        </Link>

        <Link
          href="/admin/pages/terms-affiliate"
          className="rounded-2xl border border-white/10 bg-ink-soft p-4 hover:border-cyan/50 transition-colors flex items-start gap-3"
        >
          <FileText className="h-5 w-5 text-white/70 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Điều khoản CTV</h2>
            <p className="text-xs text-muted-foreground">
              CMS: trang /terms-affiliate (slug cố định). Tạo nếu không tồn tại.
            </p>
          </div>
        </Link>
      </div>

      <AffiliateDashboard />
    </div>
  );
}
