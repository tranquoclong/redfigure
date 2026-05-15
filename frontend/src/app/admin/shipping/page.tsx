"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Plus,
  Save,
  Truck,
  RefreshCw,
  Trash2,
  CalendarDays,
  KeyRound,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/constants";

interface ShippingMethodRow {
  serviceId: number;
  name: string;
  company: string;
  isActive: boolean;
  displayName: string;
  extraDays: number;
}

export default function AdminShippingPage() {
  const queryClient = useQueryClient();

  const [tierShippingUpTo, setTierShippingUpTo] = useState("");
  const [tierMinSubtotal, setTierMinSubtotal] = useState("");
  const [tierExtraDays, setTierExtraDays] = useState("");
  const [tierError, setTierError] = useState("");
  const [tierSuccess, setTierSuccess] = useState("");
  const [cepSaved, setCepSaved] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  function parseReais(input: string): number {
    const trimmed = input.trim();
    if (trimmed === "") return NaN;

    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    return parseFloat(normalized);
  }

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/shipping/methods/sync");
      return data.data as { synced: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "shipping-methods"],
      });
      setSyncMessage(
        `${result.synced} phương thức vận chuyển đã được đồng bộ hóa`,
      );
      setTimeout(() => setSyncMessage(""), 4000);
    },
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      const msg =
        resp?.error?.message ??
        resp?.message ??
        "Lỗi khi đồng bộ hóa vận chuyển";
      setSyncMessage(msg);
      setTimeout(() => setSyncMessage(""), 6000);
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["admin", "shipping-settings"],
    queryFn: async () => {
      const { data } = await api.get("/shipping/settings");
      return data.data;
    },
  });

  const [shopCep, setShopCep] = useState("");
  const displayCep = shopCep || settings?.shopCep || "";
  const [cutoffTime, setCutoffTime] = useState("");
  const displayCutoff = cutoffTime || settings?.cutoff_time || "12:00";

  const saveCepMutation = useMutation({
    mutationFn: () =>
      api.put("/shipping/settings", {
        shopCep: displayCep,
        cutoff_time: displayCutoff,
      }),
    onSuccess: () => {
      setCepSaved(true);
      setTimeout(() => setCepSaved(false), 2000);
    },
  });

  const [defWeight, setDefWeight] = useState("");
  const [defWidth, setDefWidth] = useState("");
  const [defHeight, setDefHeight] = useState("");
  const [defLength, setDefLength] = useState("");
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  const displayDefWeight = defWeight || settings?.default_shipping_weight || "";
  const displayDefWidth = defWidth || settings?.default_shipping_width || "";
  const displayDefHeight = defHeight || settings?.default_shipping_height || "";
  const displayDefLength = defLength || settings?.default_shipping_length || "";

  const saveDefaultsMutation = useMutation({
    mutationFn: () =>
      api.put("/shipping/settings", {
        default_shipping_weight: displayDefWeight,
        default_shipping_width: displayDefWidth,
        default_shipping_height: displayDefHeight,
        default_shipping_length: displayDefLength,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "shipping-settings"],
      });
      setDefaultsSaved(true);
      setTimeout(() => setDefaultsSaved(false), 2000);
    },
  });

  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ["admin", "shipping-methods"],
    queryFn: async () => {
      const { data } = await api.get("/shipping/methods");
      return data.data as ShippingMethodRow[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (method: ShippingMethodRow) =>
      api.put(`/shipping/methods/${method.serviceId}`, {
        name: method.name,
        company: method.company,
        isActive: method.isActive,
        displayName: method.displayName || undefined,
        extraDays: method.extraDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "shipping-methods"],
      });
    },
  });

  function handleToggle(method: ShippingMethodRow) {
    toggleMutation.mutate({ ...method, isActive: !method.isActive });
  }

  function handleUpdateMethod(
    method: ShippingMethodRow,
    field: string,
    value: string | number,
  ) {
    toggleMutation.mutate({ ...method, [field]: value });
  }

  const {
    data: tiers,
    isLoading: tiersLoading,
    error: tiersError,
    refetch: refetchTiers,
  } = useQuery({
    queryKey: ["admin", "shipping-tiers"],
    queryFn: async () => {
      const { data } = await api.get("/shipping/free-tiers");

      return data.data as Array<{
        id: string;
        shippingUpTo: number | null;
        minSubtotal: number;
        extraDays: number;
        isActive: boolean;
      }>;
    },

    staleTime: 0,
    refetchOnMount: "always",
  });

  const createTierMutation = useMutation({
    mutationFn: () => {
      const upToReais = parseReais(tierShippingUpTo);
      const minReais = parseReais(tierMinSubtotal);

      if (Number.isNaN(minReais) || minReais < 0) {
        throw new Error("Số tiền tối thiểu trong giỏ hàng không hợp lệ");
      }
      if (
        tierShippingUpTo.trim() !== "" &&
        (Number.isNaN(upToReais) || upToReais < 0)
      ) {
        throw new Error(
          "Số tiền tối đa cho phép vận chuyển miễn phí không hợp lệ",
        );
      }

      const upToCents = tierShippingUpTo.trim()
        ? Math.round(upToReais * 100)
        : null;
      const minCents = Math.round(minReais * 100);
      return api.post("/shipping/free-tiers", {
        shippingUpTo: upToCents,
        minSubtotal: minCents,
        extraDays: parseInt(tierExtraDays, 10) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping-tiers"] });
      setTierShippingUpTo("");
      setTierMinSubtotal("");
      setTierExtraDays("");
      setTierError("");
      setTierSuccess("Tier được tạo thành công!");
      setTimeout(() => setTierSuccess(""), 3000);
    },
    onError: (err: unknown) => {
      const axiosResp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      const axiosMsg = axiosResp?.error?.message ?? axiosResp?.message;
      const localMsg = (err as Error)?.message;
      const msg = axiosMsg ?? localMsg ?? "Lỗi khi tạo tier";
      setTierError(msg);
      setTierSuccess("");

      console.error("[admin/shipping] failed:", err);

      void refetchTiers();
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({
      id,
      ...dto
    }: {
      id: string;
      shippingUpTo?: number | null;
      minSubtotal?: number;
      extraDays?: number;
      isActive?: boolean;
    }) => api.put(`/shipping/free-tiers/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping-tiers"] });
      setEditingTierId(null);
    },
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      const msg =
        resp?.error?.message ?? resp?.message ?? "Lỗi khi cập nhật tier";
      setTierError(msg);
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/shipping/free-tiers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping-tiers"] });
    },
    onError: (err: unknown) => {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      const msg = resp?.error?.message ?? resp?.message ?? "Lỗi khi xóa tier";
      setTierError(msg);
    },
  });

  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editShippingUpTo, setEditShippingUpTo] = useState("");
  const [editMinSubtotal, setEditMinSubtotal] = useState("");
  const [editExtraDays, setEditExtraDays] = useState("");

  function startEditTier(t: {
    id: string;
    shippingUpTo: number | null;
    minSubtotal: number;
    extraDays: number;
  }) {
    setEditingTierId(t.id);
    setEditShippingUpTo(
      t.shippingUpTo === null
        ? ""
        : (t.shippingUpTo / 100).toFixed(2).replace(".", ","),
    );
    setEditMinSubtotal((t.minSubtotal / 100).toFixed(2).replace(".", ","));
    setEditExtraDays(String(t.extraDays));
    setTierError("");
  }

  function saveEditTier() {
    if (!editingTierId) return;
    const upToReais = parseReais(editShippingUpTo);
    const minReais = parseReais(editMinSubtotal);
    if (Number.isNaN(minReais) || minReais < 0) {
      setTierError("Số tiền tối thiểu trong giỏ hàng không hợp lệ");
      return;
    }
    if (
      editShippingUpTo.trim() !== "" &&
      (Number.isNaN(upToReais) || upToReais < 0)
    ) {
      setTierError("Số tiền tối đa cho phép vận chuyển miễn phí không hợp lệ");
      return;
    }
    updateTierMutation.mutate({
      id: editingTierId,
      shippingUpTo: editShippingUpTo.trim()
        ? Math.round(upToReais * 100)
        : null,
      minSubtotal: Math.round(minReais * 100),
      extraDays: parseInt(editExtraDays, 10) || 0,
    });
  }

  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  const { data: holidays, isLoading: holidaysLoading } = useQuery({
    queryKey: ["admin", "holidays"],
    queryFn: async () => {
      const { data } = await api.get("/holidays");
      return (data.data ?? []) as Array<{
        id: string;
        date: string;
        name: string;
      }>;
    },
  });

  const createHolidayMutation = useMutation({
    mutationFn: (dto: { date: string; name: string }) =>
      api.post("/holidays", dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
      setHolidayDate("");
      setHolidayName("");
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "holidays"] });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Cấu hình vận chuyển</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cấu hình vận chuyển</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">
                Mã vận đơn của cửa hàng (nguồn gửi hàng)
              </Label>
              <Input
                placeholder="01001000"
                value={displayCep}
                onChange={(e) => setShopCep(e.target.value.replace(/\D/g, ""))}
                maxLength={8}
                className="w-40 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Thời gian cut-off để gửi hàng</Label>
              <Input
                placeholder="12:00"
                value={displayCutoff}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d:]/g, "").slice(0, 5);
                  setCutoffTime(v);
                }}
                maxLength={5}
                className="w-24 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Đơn hàng sau thời gian này sẽ được tính từ ngày tiếp theo
              </p>
            </div>
          </div>
          <Button
            onClick={() => saveCepMutation.mutate()}
            disabled={saveCepMutation.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Lưu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Thiết lập kích thước và trọng lượng mặc định
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Giá trị được sử dụng để tính phí vận chuyển{" "}
            <strong>
              khi sản phẩm/biến thể không có trọng lượng hoặc kích thước
            </strong>
            . Cache 5 phút sau khi lưu. Lý tưởng nhất là thêm trọng lượng/kích
            thước vào mỗi sản phẩm — các giá trị mặc định này chỉ là dự phòng.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Khối lượng (kg)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.3"
                value={displayDefWeight}
                onChange={(e) => setDefWeight(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chiều rộng (cm)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="11"
                value={displayDefWidth}
                onChange={(e) => setDefWidth(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chiều cao (cm)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="5"
                value={displayDefHeight}
                onChange={(e) => setDefHeight(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chiều dài (cm)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="16"
                value={displayDefLength}
                onChange={(e) => setDefLength(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
          <Button
            onClick={() => saveDefaultsMutation.mutate()}
            disabled={saveDefaultsMutation.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Lưu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Phương thức vận chuyển
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Bật các phương thức bạn muốn cung cấp. Chỉnh sửa tên hiển thị và
              số ngày bổ sung cho mỗi phương thức.
            </p>
            <div className="flex items-center gap-3">
              {syncMessage && (
                <span className="text-sm text-muted-foreground">
                  {syncMessage}
                </span>
              )}
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                size="sm"
                variant="outline"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`}
                />
                {syncMutation.isPending
                  ? "Đang đồng bộ..."
                  : "Đồng bộ hóa vận chuyển"}
              </Button>
            </div>
          </div>

          {methodsLoading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : !methods?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Chưa có vận chuyển nào được đăng ký.</p>
              <p className="text-sm mt-1">
                Nhấn vào &quot;Đồng bộ hóa vận chuyển&quot; để tìm các dịch vụ
                có sẵn.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Hoạt động</TableHead>
                    <TableHead>Dịch vụ</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead>Tên hiển thị</TableHead>
                    <TableHead className="w-28">Số ngày thêm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods?.map((method) => (
                    <TableRow
                      key={method.serviceId}
                      className={!method.isActive ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={method.isActive}
                          onChange={() => handleToggle(method)}
                          className="accent-primary h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {method.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {method.company}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={method.name}
                          defaultValue={method.displayName}
                          className="h-8 text-sm"
                          onBlur={(e) =>
                            handleUpdateMethod(
                              method,
                              "displayName",
                              e.target.value,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          defaultValue={method.extraDays}
                          className="h-8 text-sm w-20"
                          onBlur={(e) =>
                            handleUpdateMethod(
                              method,
                              "extraDays",
                              parseInt(e.target.value, 10) || 0,
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Miễn phí vận chuyển — Các mức phí tùy thuộc vào giá trị đơn hàng.
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Khi khách hàng báo giá vận chuyển, hệ thống sẽ tìm kiếm trong phạm
            vi giá trị cước vận chuyển thấp nhất phù hợp và yêu cầu số tiền tối
            thiểu của giỏ hàng từ phạm vi đó để giải phóng chi phí vận chuyển.
            Hãy để trống <em>vận chuyển lên đến</em> ở dòng cuối cùng để bao phủ{" "}
            <strong>bất kỳ chi phí vận chuyển nào trên các tier khác</strong>.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createTierMutation.mutate();
            }}
            className="flex gap-2 mb-2 items-end flex-wrap"
          >
            <div className="space-y-1">
              <Label className="text-xs">Chi phí vận chuyển (VNĐ)</Label>

              <Input
                type="text"
                inputMode="decimal"
                placeholder="15,000 (để trống = tối đa)"
                value={tierShippingUpTo}
                onChange={(e) => setTierShippingUpTo(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tổng đơn hàng tối thiểu (VNĐ)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="100,000"
                value={tierMinSubtotal}
                onChange={(e) => setTierMinSubtotal(e.target.value)}
                required
                className="w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Số ngày thêm</Label>
              <Input
                type="number"
                min={0}
                max={60}
                placeholder="0"
                value={tierExtraDays}
                onChange={(e) => setTierExtraDays(e.target.value)}
                className="w-20"
              />
            </div>
            <Button
              type="submit"
              disabled={createTierMutation.isPending}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createTierMutation.isPending ? "Lưu..." : "Thêm tier"}
            </Button>
          </form>
          {tierError && (
            <p className="text-sm text-destructive mb-3">{tierError}</p>
          )}
          {tierSuccess && (
            <p className="text-sm text-green-500 mb-3">{tierSuccess}</p>
          )}

          {tiersLoading ? (
            <p className="text-muted-foreground">Đang tải tiers...</p>
          ) : tiersError ? (
            <div className="text-sm text-destructive space-y-2">
              <p>
                Lỗi khi tải tiers:{" "}
                {(tiersError as Error)?.message ?? "Lỗi mạng"}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchTiers()}
              >
                Thử lại
              </Button>
            </div>
          ) : !tiers?.length ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Chưa có tier nào được cấu hình — miễn phí vận chuyển tự động bị
                vô hiệu hóa.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchTiers()}
              >
                Tải lại danh sách
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Giá cước tối đa</TableHead>
                    <TableHead>Tổng đơn hàng tối thiểu</TableHead>
                    <TableHead className="w-28">Số ngày thêm</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-44 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t) => {
                    const isEditing = editingTierId === t.id;
                    return (
                      <TableRow
                        key={t.id}
                        className={!t.isActive ? "opacity-50" : ""}
                      >
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Để trống = không giới hạn"
                              value={editShippingUpTo}
                              onChange={(e) =>
                                setEditShippingUpTo(e.target.value)
                              }
                              className="h-8 text-sm w-32"
                            />
                          ) : t.shippingUpTo === null ? (
                            <Badge variant="outline">Không giới hạn</Badge>
                          ) : (
                            formatCurrency(t.shippingUpTo / 100)
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={editMinSubtotal}
                              onChange={(e) =>
                                setEditMinSubtotal(e.target.value)
                              }
                              className="h-8 text-sm w-32"
                            />
                          ) : (
                            formatCurrency(t.minSubtotal / 100)
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              max={60}
                              value={editExtraDays}
                              onChange={(e) => setEditExtraDays(e.target.value)}
                              className="h-8 text-sm w-20"
                            />
                          ) : (
                            <span className="text-sm">{t.extraDays}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.isActive ? "default" : "secondary"}>
                            {t.isActive ? "Hoạt động" : "Không hoạt động"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {isEditing ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => saveEditTier()}
                                  disabled={updateTierMutation.isPending}
                                  title="Lưu"
                                  className="h-8 w-8"
                                >
                                  <Check className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingTierId(null)}
                                  title="Hủy"
                                  className="h-8 w-8"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startEditTier(t)}
                                  title="Chỉnh sửa"
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateTierMutation.mutate({
                                      id: t.id,
                                      isActive: !t.isActive,
                                    })
                                  }
                                  className="h-8 px-2 text-xs"
                                >
                                  {t.isActive ? "Vô hiệu" : "Hoạt động"}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        "Bạn có chắc chắn muốn xóa tier này? Hành động không thể hoàn tác.",
                                      )
                                    ) {
                                      deleteTierMutation.mutate(t.id);
                                    }
                                  }}
                                  title="Xóa"
                                  className="h-8 w-8 text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Ngày lễ
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Thêm ngày lễ để hệ thống tính toán ngày giao hàng.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!holidayDate || !holidayName.trim()) return;
              createHolidayMutation.mutate({
                date: holidayDate,
                name: holidayName.trim(),
              });
            }}
            className="flex gap-3 items-end max-w-xl"
          >
            <div className="space-y-1">
              <Label className="text-xs">Ngày</Label>
              <Input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Tên ngày lễ</Label>
              <Input
                placeholder="Ví dụ: Giáng Sinh, Quốc Khánh"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={createHolidayMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Thêm
            </Button>
          </form>

          {holidaysLoading ? (
            <p className="text-muted-foreground">Đang tải...</p>
          ) : !holidays?.length ? (
            <p className="text-muted-foreground text-sm">
              Chưa có ngày lễ nào được thêm.
            </p>
          ) : (
            <div className="border rounded-lg max-w-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Tên ngày lễ</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.date)}</TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm(`Chắc chắn muốn xóa "${h.name}"?`))
                              deleteHolidayMutation.mutate(h.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
