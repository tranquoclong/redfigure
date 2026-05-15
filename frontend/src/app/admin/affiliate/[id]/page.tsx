"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  Ban,
  CheckCircle2,
  Link as LinkIcon,
  Save,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/constants";
import { AffiliateVisitsList } from "@/components/affiliate-visits-list";
import { AffiliateCommissionsList } from "@/components/affiliate-commissions-list";
import { AffiliateLedgerList } from "@/components/affiliate-ledger-list";

interface Detail {
  account: {
    id: string;
    publicId: number;
    publicCode: string | null;
    status: "APPROVED" | "SUSPENDED" | "REJECTED" | "PENDING";
    createdAt: string;
    suspendedReason: string | null;
    user: { id: string; name: string | null; email: string };
  };
  overview: {
    currentBalance: number;
    pendingCommissions: number;
    approvedCommissions: number;
    cancelledCommissions: number;
    paidLifetime: number;
    visits30d: number;
    conversions30d: number;
  };
}

type Tab = "visits" | "commissions" | "ledger";

export default function AdminAffiliateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("commissions");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState<string>("");
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<{ data: Detail }>({
    queryKey: ["admin", "affiliate-detail", id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/affiliates/${id}/detail`);
      return data;
    },
    enabled: !!id,
  });

  const adjust = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(adjustAmount.replace(",", "."));
      await api.post(`/admin/affiliates/${id}/ledger-adjustment`, {
        type: adjustType,
        amount,
        reason: adjustReason.trim(),
      });
    },
    onSuccess: () => {
      setAdjustOpen(false);
      setAdjustAmount("");
      setAdjustReason("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-detail", id] });
      qc.invalidateQueries({ queryKey: ["affiliate-ledger"] });
    },
    onError: (e: unknown) => {
      const resp = (
        e as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setErr(resp?.error?.message ?? "Lỗi điều chỉnh số dư");
    },
  });

  const suspend = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/affiliates/${id}/suspend`, {
        reason: suspendReason.trim(),
      });
    },
    onSuccess: () => {
      setSuspendOpen(false);
      setSuspendReason("");
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-detail", id] });
    },
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/affiliates/${id}/reactivate`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-detail", id] });
    },
  });

  const saveCode = useMutation({
    mutationFn: async () => {
      const trimmed = codeDraft.trim().toLowerCase();
      await api.post(`/admin/affiliates/${id}/public-code`, {
        publicCode: trimmed || null,
      });
    },
    onSuccess: () => {
      setCodeErr(null);
      qc.invalidateQueries({ queryKey: ["admin", "affiliate-detail", id] });
    },
    onError: (e: unknown) => {
      const resp = (
        e as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data;
      setCodeErr(resp?.error?.message ?? "Lỗi khi lưu mã");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <p className="text-sm text-red-300">
          {(error as Error)?.message ?? "Không tìm thấy cộng tác viên"}
        </p>
      </div>
    );
  }

  const { account, overview } = data.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/affiliate/list">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <UserIcon className="h-8 w-8 text-cyan" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            #{account.publicId} · {account.user.name ?? "Không có tên"}
          </h1>
          <p className="text-sm text-muted-foreground">{account.user.email}</p>
        </div>
        <div className="flex gap-2">
          {account.status === "APPROVED" && (
            <Button
              variant="outline"
              size="sm"
              className="bg-red-950/30 border-red-500/40 text-red-300 hover:bg-red-500/20"
              onClick={() => setSuspendOpen(true)}
            >
              <Ban className="h-4 w-4 mr-1" />
              Khóa
            </Button>
          )}
          {account.status === "SUSPENDED" && (
            <Button
              variant="outline"
              size="sm"
              className="bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Kích hoạt lại
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setAdjustType("CREDIT");
              setAdjustOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Điều chỉnh số dư
          </Button>
        </div>
      </div>

      {account.status === "SUSPENDED" && account.suspendedReason && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4">
          <p className="text-sm">
            <strong className="text-red-300">Đã khóa.</strong> Lý do:{" "}
            <span className="text-muted-foreground">
              {account.suspendedReason}
            </span>
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-ink-soft p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <LinkIcon className="h-4 w-4 text-cyan" />
          <span className="font-semibold">Mã liên kết</span>
          <span className="text-xs text-muted-foreground ml-auto">
            Hiện tại:{" "}
            <code className="text-cyan">
              ?ref={account.publicCode ?? account.publicId}
            </code>
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={
              account.publicCode ??
              `publicId = ${account.publicId} (Để trống để dùng số)`
            }
            value={codeDraft}
            onChange={(e) => {
              setCodeDraft(e.target.value);
              setCodeErr(null);
            }}
            onFocus={() => {
              if (!codeDraft) setCodeDraft(account.publicCode ?? "");
            }}
            maxLength={32}
          />
          <Button
            size="sm"
            onClick={() => saveCode.mutate()}
            disabled={
              saveCode.isPending ||
              codeDraft.trim() === (account.publicCode ?? "")
            }
          >
            {saveCode.isPending && (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            )}
            <Save className="h-4 w-4 mr-1" />
            Lưu
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          3-32 ký tự, chữ thường, số, <code>-</code> và <code>_</code>. Không
          thể chỉ toàn số. Để trống = xóa (trở về publicId).
        </p>
        {codeErr && (
          <p className="text-xs text-red-300 bg-red-950/20 border border-red-500/30 rounded px-2 py-1">
            {codeErr}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Số dư"
          value={formatCurrency(overview.currentBalance)}
          color="cyan"
        />
        <StatCard
          label="Đang chờ duyệt"
          value={formatCurrency(overview.pendingCommissions)}
          color="amber"
        />
        <StatCard
          label="Đã duyệt"
          value={formatCurrency(overview.approvedCommissions)}
          color="emerald"
        />
        <StatCard
          label="Tổng hoa hồng"
          value={formatCurrency(overview.paidLifetime)}
          color="purple"
        />
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {(
          [
            { value: "commissions", label: "Hoa hồng" },
            { value: "ledger", label: "Lịch sử giao dịch" },
            { value: "visits", label: "Lượt truy cập" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t.value
                ? "border-cyan text-cyan"
                : "border-transparent text-muted-foreground hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "commissions" && (
        <AffiliateCommissionsList
          endpoint={`/admin/affiliates/${id}/commissions`}
          title=""
        />
      )}
      {tab === "ledger" && (
        <AffiliateLedgerList
          endpoint={`/admin/affiliates/${id}/ledger`}
          title=""
        />
      )}
      {tab === "visits" && (
        <AffiliateVisitsList
          endpoint={`/admin/affiliates/${id}/visits`}
          title=""
        />
      )}

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Điều chỉnh số dư</DialogTitle>
            <DialogDescription>
              Tạo entry vào sổ cái (chỉ thêm) với ID của bạn làm người chịu
              trách nhiệm. Cộng tác viên sẽ thấy lý do trong sổ cái của họ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={adjustType === "CREDIT" ? "default" : "outline"}
                size="sm"
                className={
                  adjustType === "CREDIT"
                    ? ""
                    : "bg-ink-soft border-cyan/30 text-white hover:bg-cyan/10"
                }
                onClick={() => setAdjustType("CREDIT")}
              >
                <Plus className="h-4 w-4 mr-1" />
                Cộng
              </Button>
              <Button
                variant={adjustType === "DEBIT" ? "default" : "outline"}
                size="sm"
                className={
                  adjustType === "DEBIT"
                    ? ""
                    : "bg-ink-soft border-red-500/30 text-white hover:bg-red-500/10"
                }
                onClick={() => setAdjustType("DEBIT")}
              >
                <Minus className="h-4 w-4 mr-1" />
                Trừ
              </Button>
            </div>
            <div>
              <Label>Số dư</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>
                Lý do (bắt buộc, 3-500 ký tự — hiển thị cho cộng tác viên)
              </Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ví dụ: Tiền thưởng chiến dịch tháng 4. Điều chỉnh hoa hồng đơn hàng #EP-000123."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {adjustReason.length}/500
              </p>
            </div>
            {err && (
              <div className="text-sm text-red-300 bg-red-950/20 border border-red-500/30 rounded-md px-3 py-2">
                {err}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAdjustOpen(false)}
              disabled={adjust.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={() => adjust.mutate()}
              disabled={
                adjust.isPending ||
                !adjustAmount ||
                adjustReason.trim().length < 3
              }
            >
              {adjust.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Xác nhận {adjustType === "CREDIT" ? "cộng" : "trừ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đình chỉ cộng tác viên</DialogTitle>
            <DialogDescription>
              Cộng tác viên sẽ ngừng tích lũy hoa hồng mới. Số dư hiện tại và
              hoa hồng đang chờ xử lý sẽ được giữ nguyên.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Lý do</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => suspend.mutate()}
              disabled={suspend.isPending || suspendReason.trim().length < 3}
              className="bg-red-600 hover:bg-red-700"
            >
              {suspend.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Xác nhận đình chỉ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "cyan" | "amber" | "emerald" | "purple";
}) {
  const colorMap = {
    cyan: "text-cyan border-cyan/30",
    amber: "text-amber-400 border-amber-500/30",
    emerald: "text-emerald-400 border-emerald-500/30",
    purple: "text-purple border-purple/30",
  };
  return (
    <div
      className={`rounded-2xl border bg-ink-soft p-4 ${colorMap[color].split(" ")[1]}`}
    >
      <p className="text-xs text-muted-foreground uppercase mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorMap[color].split(" ")[0]}`}>
        {value}
      </p>
    </div>
  );
}
