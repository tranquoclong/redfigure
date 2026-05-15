"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Handshake,
  TrendingUp,
  DollarSign,
  XCircle,
  ShoppingBag,
  Eye,
  MousePointerClick,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/constants";

interface DashboardStats {
  totalCommissions: number;
  paidCommissions: number;
  cancelledCommissions: number;
  totalAffiliateEarnings: number;
  totalVisits: number;
  totalConversions: number;
  conversionRate: number;
  avgConversionTimeHours: number;
}

interface TimeSeriesPoint {
  date: string;
  total: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  totalCommissions: number;
  totalOrders: number;
}

interface TopAffiliate {
  affiliateId: string;
  publicId: number;
  name: string | null;
  email: string;
  totalCommissions: number;
  totalOrders: number;
}

type Preset = "today" | "7d" | "month" | "year" | "custom";

function rangeForPreset(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (preset === "7d") from.setDate(from.getDate() - 6);
  else if (preset === "month") from.setDate(1);
  else if (preset === "year") {
    from.setMonth(0);
    from.setDate(1);
  }
  return { from, to };
}

function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const diff = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - diff);
  return { from: prevFrom, to: prevTo };
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

function delta(now: number, prev: number): number | null {
  if (prev === 0) return now === 0 ? 0 : null;
  return ((now - prev) / prev) * 100;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  deltaPct,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  deltaPct: number | null;
  accent: string;
}) {
  const up = deltaPct != null && deltaPct >= 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold">{value}</div>
        {deltaPct != null && (
          <div
            className={`text-xs ${up ? "text-emerald-400" : "text-rose-400"}`}
          >
            {up ? "+" : ""}
            {deltaPct.toFixed(1)}% vs. kỳ trước
          </div>
        )}
        {deltaPct == null && (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AffiliateDashboard() {
  const [preset, setPreset] = useState<Preset>("month");
  const { from, to } = useMemo(() => rangeForPreset(preset), [preset]);
  const prev = useMemo(() => previousRange(from, to), [from, to]);

  const rangeParams = (f: Date, t: Date) =>
    `dateFrom=${f.toISOString()}&dateTo=${t.toISOString()}`;

  const currentStats = useQuery<DashboardStats>({
    queryKey: [
      "admin-affiliate-stats",
      "current",
      from.getTime(),
      to.getTime(),
    ],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/affiliates/stats?${rangeParams(from, to)}`,
      );
      return data.data;
    },
  });

  const previousStats = useQuery<DashboardStats>({
    queryKey: [
      "admin-affiliate-stats",
      "previous",
      prev.from.getTime(),
      prev.to.getTime(),
    ],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/affiliates/stats?${rangeParams(prev.from, prev.to)}`,
      );
      return data.data;
    },
  });

  const timeSeries = useQuery<TimeSeriesPoint[]>({
    queryKey: ["admin-affiliate-stats", "series", from.getTime(), to.getTime()],
    queryFn: async () => {
      const [current, previous] = await Promise.all([
        api.get(
          `/admin/affiliates/stats/timeseries?${rangeParams(from, to)}&granularity=day`,
        ),
        api.get(
          `/admin/affiliates/stats/timeseries?${rangeParams(prev.from, prev.to)}&granularity=day`,
        ),
      ]);

      const cur: TimeSeriesPoint[] = current.data.data;
      const prv: TimeSeriesPoint[] = previous.data.data;
      const len = Math.max(cur.length, prv.length);
      const merged: Array<{
        date: string;
        current: number | null;
        previous: number | null;
      }> = [];
      for (let i = 0; i < len; i++) {
        merged.push({
          date: cur[i]?.date ?? prv[i]?.date ?? "",
          current: cur[i]?.total ?? null,
          previous: prv[i]?.total ?? null,
        });
      }
      return merged as unknown as TimeSeriesPoint[];
    },
  });

  const topProducts = useQuery<TopProduct[]>({
    queryKey: [
      "admin-affiliate-stats",
      "top-products",
      from.getTime(),
      to.getTime(),
    ],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/affiliates/stats/top-products?${rangeParams(from, to)}&limit=5`,
      );
      return data.data;
    },
  });

  const topAffiliates = useQuery<TopAffiliate[]>({
    queryKey: [
      "admin-affiliate-stats",
      "top-affiliates",
      from.getTime(),
      to.getTime(),
    ],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/affiliates/stats/top-affiliates?${rangeParams(from, to)}&limit=5`,
      );
      return data.data;
    },
  });

  const s = currentStats.data;
  const p = previousStats.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan" />
            Tổng quan
          </h2>
          <p className="text-xs text-muted-foreground">
            {from.toLocaleDateString("vi-VN")} —{" "}
            {to.toLocaleDateString("vi-VN")}
          </p>
        </div>

        <div className="flex gap-1 text-sm">
          {(["today", "7d", "month", "year"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-md border transition-colors ${
                preset === p
                  ? "bg-cyan/20 border-cyan text-cyan"
                  : "border-white/10 text-muted-foreground hover:border-white/30"
              }`}
            >
              {p === "today" && "Hôm nay"}
              {p === "7d" && "7 ngày"}
              {p === "month" && "Tháng"}
              {p === "year" && "Năm"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={DollarSign}
          label="Tổng hoa hồng"
          value={formatCurrency(s?.totalCommissions ?? 0)}
          deltaPct={delta(s?.totalCommissions ?? 0, p?.totalCommissions ?? 0)}
          accent="text-purple"
        />
        <KpiCard
          icon={Handshake}
          label="Hoa hồng đã thanh toán"
          value={formatCurrency(s?.paidCommissions ?? 0)}
          deltaPct={delta(s?.paidCommissions ?? 0, p?.paidCommissions ?? 0)}
          accent="text-emerald-500"
        />
        <KpiCard
          icon={XCircle}
          label="Hoa hồng đã hủy"
          value={formatCurrency(s?.cancelledCommissions ?? 0)}
          deltaPct={delta(
            s?.cancelledCommissions ?? 0,
            p?.cancelledCommissions ?? 0,
          )}
          accent="text-rose-400"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Thu nhập từ tiếp thị liên kết"
          value={formatCurrency(s?.totalAffiliateEarnings ?? 0)}
          deltaPct={delta(
            s?.totalAffiliateEarnings ?? 0,
            p?.totalAffiliateEarnings ?? 0,
          )}
          accent="text-cyan"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Eye}
          label="Tổng lượt truy cập"
          value={(s?.totalVisits ?? 0).toLocaleString("vi-VN")}
          deltaPct={delta(s?.totalVisits ?? 0, p?.totalVisits ?? 0)}
          accent="text-cyan"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Đơn hàng thành công"
          value={(s?.totalConversions ?? 0).toLocaleString("vi-VN")}
          deltaPct={delta(s?.totalConversions ?? 0, p?.totalConversions ?? 0)}
          accent="text-emerald-500"
        />
        <KpiCard
          icon={TrendingUp}
          label="Tỷ lệ chuyển đổi"
          value={`${(s?.conversionRate ?? 0).toFixed(2)}%`}
          deltaPct={delta(s?.conversionRate ?? 0, p?.conversionRate ?? 0)}
          accent="text-purple"
        />
        <KpiCard
          icon={Clock}
          label="Thời gian trung bình để chuyển đổi"
          value={formatHours(s?.avgConversionTimeHours ?? 0)}
          deltaPct={null}
          accent="text-amber-400"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Hoa hồng theo ngày — hiện tại và trước đó
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            {timeSeries.data && timeSeries.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={
                    timeSeries.data as unknown as {
                      date: string;
                      current: number;
                      previous: number;
                    }[]
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) =>
                      new Date(v).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    }
                    stroke="#ffffff90"
                    fontSize={11}
                  />
                  <YAxis stroke="#ffffff90" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f0421",
                      border: "1px solid #ff007a40",
                      borderRadius: 8,
                    }}
                    formatter={(v) => formatCurrency(Number(v ?? 0))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="current"
                    name="Hiện tại"
                    stroke="#ff007a"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    name="Kỳ trước"
                    stroke="#00f0ff"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Không có dữ liệu
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top sản phẩm</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.data && topProducts.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left py-2">Sản phẩm</th>
                    <th className="text-right py-2">Đơn hàng</th>
                    <th className="text-right py-2">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topProducts.data.map((p) => (
                    <tr key={p.productId}>
                      <td className="py-2 truncate max-w-[240px]">
                        {p.productName}
                      </td>
                      <td className="text-right py-2 text-muted-foreground">
                        {p.totalOrders}
                      </td>
                      <td className="text-right py-2 font-medium">
                        {formatCurrency(p.totalCommissions)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top tiếp thị liên kết</CardTitle>
          </CardHeader>
          <CardContent>
            {topAffiliates.data && topAffiliates.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="text-left py-2">Tiếp thị liên kết</th>
                    <th className="text-right py-2">Đơn hàng</th>
                    <th className="text-right py-2">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topAffiliates.data.map((a) => (
                    <tr key={a.affiliateId}>
                      <td className="py-2 max-w-[220px]">
                        <p className="truncate">
                          #{a.publicId} {a.name ?? a.email}
                        </p>
                      </td>
                      <td className="text-right py-2 text-muted-foreground">
                        {a.totalOrders}
                      </td>
                      <td className="text-right py-2 font-medium">
                        {formatCurrency(a.totalCommissions)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
