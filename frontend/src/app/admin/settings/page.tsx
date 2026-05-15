"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Save,
  Loader2,
  RefreshCw,
  Copy,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";

import { extractError } from "@/lib/extract-error";
interface SettingsCardProps {
  title: string;
  fields: Array<{
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    suffix?: string;
  }>;
  values: Record<string, string>;
}

function SettingsCard({ title, fields, values }: SettingsCardProps) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const serverValues: Record<string, string> = {};
  for (const f of fields) {
    serverValues[f.key] = values[f.key] ?? "";
  }

  const [local, setLocal] = useState<Record<string, string>>(serverValues);

  const serverKey = fields.map((f) => values[f.key] ?? "").join("|");
  const [lastServerKey, setLastServerKey] = useState(serverKey);
  if (serverKey !== lastServerKey) {
    setLastServerKey(serverKey);
    setLocal(serverValues);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        payload[f.key] = local[f.key] ?? "";
      }
      await api.put("/shipping/settings", payload);
    },
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(extractError(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div
              key={f.key}
              className={
                f.type === "time" ? "sm:col-span-2 space-y-1" : "space-y-1"
              }
            >
              <Label className="text-xs">{f.label}</Label>
              <div className="flex items-center gap-2">
                {f.type === "time" ? (
                  <input
                    type="time"
                    value={local[f.key] ?? ""}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="h-10 rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:border-cyan/70 focus:shadow-[0_0_0_3px_rgba(0,240,255,0.15)]"
                  />
                ) : (
                  <Input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={local[f.key] ?? ""}
                    onChange={(e) =>
                      setLocal((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                  />
                )}
                {f.suffix && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {f.suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          size="sm"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? "Đã lưu!" : "Lưu"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data } = await api.get("/shipping/settings");
      return (data.data ?? {}) as Record<string, string>;
    },
  });

  const values = settings ?? {};

  if (isLoading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Cấu hình</h1>
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Cấu hình</h1>

      <div className="space-y-6 max-w-2xl">
        {/* <SettingsCard
          title="Giảm giá theo phương thức thanh toán"
          values={values}
          fields={[
            {
              key: "card_max_installments",
              label: "Số lần trả góp tối đa (thẻ)",
              type: "number",
              placeholder: "3",
              suffix: "x không lãi suất",
            },
          ]}
        /> */}

        <GoogleOAuthCard />

        <BusinessCustomersCard />

        <SettingsCard
          title="Sản xuất"
          values={values}
          fields={[
            {
              key: "base_production_days",
              label: "Thời gian sản xuất cơ bản",
              type: "number",
              placeholder: "3",
              suffix: "ngày làm việc",
            },
          ]}
        />

        <SettingsCard
          title="Giỏ hàng Pre"
          values={values}
          fields={[
            {
              key: "pre_cart_max_price",
              label: 'Giá trị tối đa "Hoàn thiện giỏ hàng"',
              type: "number",
              placeholder: "50000",
              suffix: "VNĐ",
            },
          ]}
        />

        <SettingsCard
          title="Kho hàng"
          values={values}
          fields={[
            {
              key: "low_stock_threshold",
              label: "Ngưỡng tồn kho thấp (toàn cục)",
              type: "number",
              placeholder: "5",
              suffix: "đơn vị",
            },
            {
              key: "low_stock_email_recipients",
              label: "Email quản trị viên (cảnh báo + liên hệ)",
              type: "text",
              placeholder: "admin@redfigure.com",
            },
          ]}
        />

        <SettingsCard
          title="Đánh giá & Phần thưởng"
          values={values}
          fields={[
            {
              key: "review_enabled",
              label: "Kích hoạt luồng (true/false)",
              placeholder: "true",
            },
            {
              key: "review_first_email_days",
              label: "Ngày sau khi giao hàng để gửi email đầu tiên",
              type: "number",
              placeholder: "2",
              suffix: "ngày",
            },
            {
              key: "review_reminder_days",
              label: "Ngày sau email đầu tiên để nhắc nhở",
              type: "number",
              placeholder: "2",
              suffix: "ngày",
            },
            {
              key: "review_coupon_type",
              label: "Loại phiếu giảm giá (PERCENTAGE/FIXED)",
              placeholder: "PERCENTAGE",
            },
            {
              key: "review_coupon_value",
              label: "Giá trị phiếu giảm giá",
              type: "number",
              placeholder: "10",
            },
            {
              key: "review_coupon_validity_days",
              label: "Thời hạn hiệu lực của phiếu giảm giá",
              type: "number",
              placeholder: "30",
              suffix: "ngày",
            },
            {
              key: "review_coupon_min_order",
              label: "Giá trị đơn hàng tối thiểu để sử dụng phiếu giảm giá",
              type: "number",
              placeholder: "0",
              suffix: "VNĐ",
            },
            {
              key: "review_coupon_stackable",
              label:
                "Phiếu giảm giá có thể được sử dụng cùng với các phiếu giảm giá khác không (true/false)",
              placeholder: "false",
            },
            {
              key: "review_invite_validity_days",
              label: "Thời hạn hiệu lực của liên kết đánh giá",
              type: "number",
              placeholder: "30",
              suffix: "ngày",
            },
            {
              key: "review_max_photos",
              label: "Số lượng ảnh tối đa cho mỗi đánh giá",
              type: "number",
              placeholder: "5",
            },
            {
              key: "review_max_photo_size_mb",
              label: "Kích thước tối đa cho mỗi ảnh",
              type: "number",
              placeholder: "5",
              suffix: "MB",
            },
          ]}
        />

        <SettingsCard
          title="Giỏ hàng bỏ quên"
          values={values}
          fields={[
            {
              key: "cart_abandonment_first_enabled",
              label: "Kích hoạt email đầu tiên (true/false)",
              placeholder: "false",
            },
            {
              key: "cart_abandonment_first_delay_hours",
              label: "Số giờ sau khi giỏ hàng bị bỏ quên để gửi email đầu tiên",
              type: "number",
              placeholder: "24",
              suffix: "giờ",
            },
            {
              key: "cart_abandonment_second_enabled",
              label: "Kích hoạt email thứ 2 — với phiếu giảm giá (true/false)",
              placeholder: "false",
            },
            {
              key: "cart_abandonment_second_delay_hours",
              label:
                "Số giờ sau email đầu tiên để gửi email thứ 2 (phiếu giảm giá)",
              type: "number",
              placeholder: "48",
              suffix: "giờ",
            },
            {
              key: "cart_abandonment_coupon_type",
              label: "Loại phiếu giảm giá (PERCENTAGE/FIXED)",
              placeholder: "PERCENTAGE",
            },
            {
              key: "cart_abandonment_coupon_value",
              label: "Giá trị phiếu giảm giá",
              type: "number",
              placeholder: "10",
            },
            {
              key: "cart_abandonment_coupon_validity_hours",
              label: "Thời hạn hiệu lực của phiếu giảm giá",
              type: "number",
              placeholder: "72",
              suffix: "giờ",
            },
            {
              key: "cart_abandonment_coupon_min_order_value",
              label: "Giá trị đơn hàng tối thiểu để sử dụng phiếu giảm giá",
              type: "number",
              placeholder: "0",
              suffix: "VNĐ",
            },
          ]}
        />

        <SettingsCard
          title="Cộng tác viên"
          values={values}
          fields={[
            {
              key: "affiliate_enabled",
              label: "Kích hoạt module (kill-switch)",
              placeholder: "false",
            },
            {
              key: "affiliate_default_commission_rate",
              label: "Tỷ lệ hoa hồng mặc định toàn cục",
              type: "number",
              placeholder: "5.00",
              suffix: "%",
            },
            {
              key: "affiliate_cookie_days",
              label: "Thời hạn cookie ?ref=",
              type: "number",
              placeholder: "30",
              suffix: "ngày",
            },
            {
              key: "affiliate_hold_days_after_delivery",
              label: "Thời gian hold sau khi giao hàng để phê duyệt hoa hồng",
              type: "number",
              placeholder: "7",
              suffix: "ngày",
            },
            {
              key: "affiliate_min_payout_amount",
              label: "Số dư tối thiểu để yêu cầu thanh toán",
              type: "number",
              placeholder: "100000",
              suffix: "VNĐ",
            },
            {
              key: "affiliate_exclude_self_referral",
              label: "Chặn tự mua hàng (chống tự giới thiệu)",
              placeholder: "true",
            },
            {
              key: "affiliate_include_shipping",
              label: "Tính hoa hồng trên phí vận chuyển",
              placeholder: "false",
            },
            {
              key: "affiliate_log_ip",
              label:
                "Ghi nhật ký IP (đã mã hóa, yêu cầu AFFILIATE_IP_HASH_SALT)",
              placeholder: "false",
            },
            {
              key: "affiliate_visit_dedup_seconds",
              label: "Cửa sổ dedupe truy cập (cùng phiên)",
              type: "number",
              placeholder: "60",
              suffix: "giây",
            },
            {
              key: "affiliate_visit_retention_days",
              label: "Giữ lại các lần truy cập chưa được chuyển đổi",
              type: "number",
              placeholder: "30",
              suffix: "ngày",
            },
            {
              key: "affiliate_notify_admin_new_payment_request",
              label: "Email admin khi cộng tác viên yêu cầu thanh toán",
              placeholder: "true",
            },
            {
              key: "affiliate_session_flag_threshold",
              label: "Ngưỡng chuyển đổi/24h mỗi phiên (cờ gian lận)",
              type: "number",
              placeholder: "10",
              suffix: "lượt chuyển đổi",
            },
          ]}
        />

        <ProductDefaultsCard />

        <DropboxSettingsCard />

        <AiSettingsCard />

        <AiInstructionPresetsCard />

        <MediaCaptionPresetsCard />

        <ReindexCard />

        <ObservabilityDebugCard />
      </div>
    </div>
  );
}

function ObservabilityDebugCard() {
  const [msg, setMsg] = useState("");

  async function triggerBackend(type: "sync" | "async" | "undefined-fn") {
    setMsg(`Lỗi backend (${type})...`);
    try {
      await api.get(`/_debug/throw${type === "sync" ? "" : `?type=${type}`}`);
      setMsg("Backend không trả về lỗi (sai).");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      setMsg(
        `Backend trả về ${status ?? "?"} (sai). Kiểm tra Sentry → Issues lọc theo redfigure-backend trong ~30s.`,
      );
    }
  }

  async function triggerSlowQuery(ms: number) {
    setMsg(`Truy vấn chậm (${ms}ms)...`);
    try {
      const { data } = await api.get<{ data: { duration_ms: number } }>(
        `/_debug/slow-query?ms=${ms}`,
      );
      setMsg(
        `Hoàn thành trong ${data.data?.duration_ms ?? "?"}ms. Kiểm tra logs container (warn/error) và Sentry → breadcrumb prisma.slow_query.`,
      );
    } catch (err) {
      setMsg(`Lỗi truy vấn chậm: ${(err as Error).message}`);
    }
  }

  function triggerFrontendSync() {
    setMsg("Lỗi frontend...");

    setTimeout(() => {
      throw new Error("Sentry test: frontend sync error from /admin/settings");
    }, 50);
    setMsg(
      "Lỗi đã được kích hoạt. Kiểm tra Sentry → Issues lọc theo redfigure-frontend trong ~30s.",
    );
  }

  function triggerFrontendUndefined() {
    setMsg("Gọi hàm không tồn tại...");
    setTimeout(() => {
      (window as unknown as Record<string, () => void>).__nonexistent_fn__();
    }, 50);
    setMsg("TypeError đã được kích hoạt. Kiểm tra Sentry → Issues trong ~30s.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Kiểm thử Khả năng quan sát</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Tạo lỗi cố ý để kiểm tra việc ghi nhận lỗi trên Sentry. Sử dụng sau
          khi triển khai hoặc khi cần xác nhận pipeline đang hoạt động bình
          thường. Giới hạn 3 lỗi/phút ở backend để tránh vượt quá hạn mức.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Backend (NestJS)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerBackend("sync")}
            >
              Lỗi 500 (sync)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerBackend("async")}
            >
              Promise rejected
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerBackend("undefined-fn")}
            >
              TypeError
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">
            Slow query (test pipeline Prisma + Pino warn + Sentry breadcrumb)
          </Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerSlowQuery(400)}
            >
              Query 400ms (warn)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerSlowQuery(1500)}
            >
              Query 1500ms (error)
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Frontend (Next.js)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerFrontendSync}
            >
              Throw Error sync
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerFrontendUndefined}
            >
              Function undefined
            </Button>
          </div>
        </div>
        {msg && (
          <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DropboxSettingsCard() {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { rootPath };
      if (accessToken) body.accessToken = accessToken;
      if (refreshToken) body.refreshToken = refreshToken;
      if (appKey) body.appKey = appKey;
      if (appSecret) body.appSecret = appSecret;
      await api.put("/dropbox/settings", body);
      setSaved(true);
      setAccessToken("");
      setRefreshToken("");
      setAppSecret("");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dropbox</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Tokens được mã hóa trong cơ sở dữ liệu. Để trống để giữ nguyên giá trị
          hiện tại.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">App Key</Label>
            <Input
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="8magdwj..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">App Secret</Label>
            <Input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Dán vào đây (được lưu trữ mã hóa)"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Access Token</Label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Dán vào đây (được lưu trữ mã hóa)"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Refresh Token</Label>
            <Input
              type="password"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Dán vào đây (được lưu trữ mã hóa)"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Thư mục gốc (tùy chọn)</Label>
            <Input
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="/Miniaturas"
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? "Đã lưu" : "Lưu cài đặt"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductDefaultsCard() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/settings/product-defaults")
      .then(({ data }) => {
        setValues(data.data ?? {});
      })
      .catch(() => {});
  }, []);

  const { data: colors } = useQuery({
    queryKey: ["admin", "colors"],
    queryFn: async () => {
      const { data } = await api.get("/colors");
      return (data.data ?? data) as Array<{ id: string; name: string }>;
    },
  });
  const { data: materials } = useQuery({
    queryKey: ["admin", "materials"],
    queryFn: async () => {
      const { data } = await api.get("/materials");
      return (data.data ?? data) as Array<{ id: string; name: string }>;
    },
  });

  function update(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put("/settings/product-defaults", values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const numericFields = [
    { key: "weight", label: "Trọng lượng (kg)", placeholder: "0.040" },
    { key: "width", label: "Chiều rộng (cm)", placeholder: "1" },
    { key: "height", label: "Chiều cao (cm)", placeholder: "1" },
    { key: "length", label: "Chiều dài (cm)", placeholder: "1" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cấu hình sản phẩm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Giá trị mặc định khi tạo sản phẩm mới. Người dùng có thể thay đổi tùy
          ý.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {numericFields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Trạng thái</Label>
            <select
              value={values.condition ?? "new"}
              onChange={(e) => update("condition", e.target.value)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="new">Mới</option>
              <option value="refurbished">Phục hồi</option>
              <option value="used">Qua sử dụng</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Màu sắc mặc định</Label>
            <select
              value={values.colorId ?? ""}
              onChange={(e) => update("colorId", e.target.value)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Không có</option>
              {colors?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chất liệu mặc định</Label>
            <select
              value={values.materialId ?? ""}
              onChange={(e) => update("materialId", e.target.value)}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Không có</option>
              {materials?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? "Đã lưu" : "Lưu"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AiSettingsCard() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    api
      .get("/settings/ai")
      .then(({ data }) => {
        const d = data.data;
        setModel(d.ai_model ?? "");
        setPrompt(d.ai_product_prompt ?? "");
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, string> = {};
      if (apiKey) body.ai_api_key = apiKey;
      if (model) body.ai_model = model;
      body.ai_product_prompt = prompt;
      await api.put("/settings/ai", body);
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await api.post("/settings/ai-test");
      setTestResult("Kết nối OK!");
    } catch (err) {
      setTestResult(extractError(err));
    } finally {
      setTesting(false);
    }
  }

  async function handleLoadModels() {
    setLoadingModels(true);
    try {
      const { data } = await api.get("/settings/ai-models");
      setModels(data.data ?? []);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">AI (Gemini)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">API Key (Google AI Studio)</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Dán API key vào đây (được lưu trữ mã hóa)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Testing..." : "Test"}
            </Button>
          </div>
          {testResult && (
            <p
              className={`text-xs ${testResult.includes("OK") ? "text-green-500" : "text-destructive"}`}
            >
              {testResult}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <div className="flex gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan/70"
            >
              <option value="">Chọn model</option>
              {models.length > 0
                ? models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                : model && <option value={model}>{model}</option>}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadModels}
              disabled={loadingModels}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Prompt AI</Label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="flex w-full rounded-xl border border-purple/15 bg-black/40 px-3 py-2 text-xs text-white font-mono outline-none focus:border-cyan/70 resize-y"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu...
            </>
          ) : saved ? (
            <>
              <Save className="h-4 w-4 mr-2" /> Đã lưu!
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Lưu cấu hình AI
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReindexCard() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleReindex() {
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.post("/search/reindex", {}, { timeout: 120000 });
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      const msg =
        (
          err as {
            response?: {
              data?: { error?: { message?: string }; message?: string };
            };
          }
        )?.response?.data?.error?.message ??
        (err as { message?: string })?.message ??
        "Lỗi không xác định";
      setErrorMsg(msg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tìm kiếm (Elasticsearch)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Xây dựng lại chỉ mục cho tất cả sản phẩm trong Elasticsearch. Sử dụng
          sau khi nhập sản phẩm hoặc sửa dữ liệu.
        </p>
        <EsHealthStatus />
        <Button
          onClick={handleReindex}
          disabled={status === "loading"}
          size="sm"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {status === "loading"
            ? "Đang xây dựng lại chỉ mục..."
            : status === "success"
              ? "Đã xây dựng lại!"
              : status === "error"
                ? "Lỗi - thử lại"
                : "Xây dựng lại chỉ mục"}
        </Button>
        {status === "error" && errorMsg && (
          <p className="text-xs text-destructive mt-2">{errorMsg}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EsHealthStatus() {
  const [info, setInfo] = useState<{
    status: string;
    version?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    api
      .get("/search/health", { timeout: 15000 })
      .then(({ data }) => setInfo(data.data))
      .catch((err) =>
        setInfo({ status: "error", message: (err as Error).message }),
      );
  }, []);

  if (!info)
    return (
      <p className="text-xs text-muted-foreground">Đang kiểm tra kết nối...</p>
    );

  if (info.status === "ok") {
    return (
      <p className="text-xs text-green-600">
        Elasticsearch kết nối (v{info.version})
      </p>
    );
  }

  return (
    <p className="text-xs text-destructive">
      Elasticsearch không khả dụng: {info.message}
    </p>
  );
}

interface InstructionPreset {
  name: string;
  text: string;
}

function AiInstructionPresetsCard() {
  const [items, setItems] = useState<InstructionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/settings/ai-instruction-presets")
      .then(({ data }) => setItems(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addEmpty() {
    setItems((prev) => [...prev, { name: "", text: "" }]);
  }

  function updateItem(index: number, patch: Partial<InstructionPreset>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const clean = items.filter((it) => it.name.trim() && it.text.trim());
      await api.put("/settings/ai-instruction-presets", { presets: clean });
      setItems(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preset hướng dẫn AI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Mẫu văn bản hiển thị dưới dạng dropdown trên màn hình &ldquo;Nhập từ
          Dropbox&rdquo; — nhấp vào sẽ thêm vào trường &ldquo;Hướng dẫn thêm
          (AI)&rdquo;.
        </p>

        {loading && <p className="text-xs text-muted-foreground">Đang tải…</p>}

        {!loading &&
          items.map((preset, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border bg-background/50 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tên</Label>
                    <Input
                      value={preset.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="VD: Điều kiện đặc biệt"
                      maxLength={80}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nội dung</Label>
                    <textarea
                      value={preset.text}
                      onChange={(e) => updateItem(i, { text: e.target.value })}
                      placeholder="VD: Hãy cho biết rằng sản phẩm này có điều kiện giao hàng đặc biệt"
                      maxLength={2000}
                      rows={2}
                      className="flex w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeItem(i)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

        {!loading && items.length < 50 && (
          <Button variant="outline" size="sm" onClick={addEmpty} type="button">
            <Plus className="h-4 w-4 mr-1" /> Thêm preset
          </Button>
        )}

        <div className="pt-2 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Đã lưu!" : "Lưu preset"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CaptionPresetRow {
  id?: string;
  name: string;
  text: string;
}

function MediaCaptionPresetsCard() {
  const [items, setItems] = useState<CaptionPresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get("/settings/media-caption-presets")
      .then(({ data }) => setItems(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addEmpty() {
    setItems((prev) => [...prev, { name: "", text: "" }]);
  }

  function updateItem(index: number, patch: Partial<CaptionPresetRow>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const clean = items
        .filter((it) => it.name.trim() && it.text.trim())
        .map((it) => ({ id: it.id, name: it.name, text: it.text }));
      const { data } = await api.put("/settings/media-caption-presets", {
        presets: clean,
      });

      setItems(data.data ?? clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mẫu chú thích ảnh</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Mẫu văn bản hiển thị dưới dạng dropdown bên cạnh trường &ldquo;Chú
          thích ảnh&rdquo; trong quá trình đăng ký sản phẩm — nhấp vào sẽ áp
          dụng văn bản vào ô nhập. Chú thích là thuộc tính của ảnh và xuất hiện
          trong <strong>tất cả</strong> các sản phẩm sử dụng ảnh này.
        </p>

        {loading && <p className="text-xs text-muted-foreground">Đang tải…</p>}

        {!loading &&
          items.map((preset, i) => (
            <div
              key={i}
              className="space-y-2 rounded-md border bg-background/50 p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tên</Label>
                    <Input
                      value={preset.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="VD: Ảnh minh họa"
                      maxLength={80}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nội dung</Label>
                    <textarea
                      value={preset.text}
                      onChange={(e) => updateItem(i, { text: e.target.value })}
                      placeholder="VD: Ảnh minh họa — mẫu chỉ để minh họa không bán kèm"
                      maxLength={200}
                      rows={2}
                      className="flex w-full rounded-md border bg-background px-3 py-2 text-sm resize-y"
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive shrink-0"
                  onClick={() => removeItem(i)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

        {!loading && items.length < 50 && (
          <Button variant="outline" size="sm" onClick={addEmpty} type="button">
            <Plus className="h-4 w-4 mr-1" /> Thêm preset
          </Button>
        )}

        <div className="pt-2 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? "Đã lưu!" : "Lưu preset"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface GoogleOAuthAdminConfig {
  enabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  callbackUrl: string;
}

function GoogleOAuthCard() {
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecretOnServer, setHasSecretOnServer] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: GoogleOAuthAdminConfig }>("/auth/admin/google-oauth")
      .then(({ data }) => {
        if (cancelled) return;
        const cfg = data.data;
        setEnabled(cfg.enabled);
        setClientId(cfg.clientId ?? "");
        setHasSecretOnServer(cfg.hasClientSecret);
        setCallbackUrl(cfg.callbackUrl);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: {
        enabled: boolean;
        clientId: string | null;
        clientSecret?: string;
      } = {
        enabled,
        clientId: clientId.trim() === "" ? null : clientId.trim(),
      };

      if (clientSecret) body.clientSecret = clientSecret;
      await api.put("/auth/admin/google-oauth", body);
      setSaved(true);
      setHasSecretOnServer(hasSecretOnServer || Boolean(clientSecret));
      setClientSecret("");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  function copyCallback() {
    if (!callbackUrl) return;
    navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Đăng nhập với Google</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Cho phép khách hàng đăng nhập hoặc đăng ký bằng tài khoản Google. Khi
          bật, nút sẽ xuất hiện trên các màn hình /login và /register.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loaded && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        )}

        {loaded && (
          <>
            {error && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">
                URL callback (Authorized redirect URI)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={callbackUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyCallback}
                  title="Sao chép"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {copied
                  ? "Đã sao chép!"
                  : "Dán chính xác URL này vào Google Cloud Console → OAuth Client → Authorized redirect URIs."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="google_oauth_enabled"
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-magenta"
              />
              <label htmlFor="google_oauth_enabled" className="text-sm">
                Cho phép đăng nhập bằng Google
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123-abc.apps.googleusercontent.com"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nhận dạng ứng dụng trên Google Cloud.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={
                    hasSecretOnServer
                      ? "•••••••••••• (đã điền — để trống để giữ nguyên)"
                      : "GOCSPX-..."
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Được lưu mã hóa (AES-256-GCM).{" "}
                  {hasSecretOnServer ? "Đã cấu hình." : "Chưa cấu hình."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang lưu…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Lưu
                  </>
                )}
              </Button>
              {saved && <span className="text-sm text-green-500">Đã lưu!</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BusinessCustomersCard() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: { enabled: boolean } }>("/users/admin/business-settings")
      .then(({ data }) => {
        if (cancelled) return;
        setEnabled(Boolean(data.data?.enabled));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(next: boolean) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.put("/users/admin/business-settings", { enabled: next });
      setEnabled(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Cho phép khách hàng Business (MST)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Khi bật, khách hàng có thể đăng ký với MST + công ty.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loaded && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        )}
        {loaded && (
          <>
            {error && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                disabled={saving}
                onChange={(e) => handleToggle(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {enabled
                    ? "Khách hàng Business (MST) được phép đăng ký"
                    : "Chỉ dành cho cá nhân (CCCD)"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Backend từ chối mọi payload chứa MST khi toggle này tắt, ngay
                  cả khi gọi trực tiếp qua API.
                </div>
              </div>
            </label>
            {saved && <span className="text-sm text-green-500">Đã lưu!</span>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
