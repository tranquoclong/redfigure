"use client";
import type { ApiRecord } from "@/types/api";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Save,
  MapPin,
  ShoppingBag,
  Eye,
  Heart,
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { formatDate, formatCurrency, formatDateTime } from "@/lib/constants";
import { statusLabel } from "@/components/admin/order-status-pills";

import { extractError } from "@/lib/extract-error";
function formatCccd(cccd: string): string {
  const digits = cccd.replace(/\D/g, "");
  if (digits.length !== 11) return cccd;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatMst(mst: string): string {
  const d = mst.toUpperCase().slice(0, 14);
  if (d.length !== 14) return mst;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export default function AdminClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCccd, setEditCccd] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState("");

  const currentUser = useAuthStore((s) => s.user);
  const [roleDialog, setRoleDialog] = useState(false);
  const [roleConfirmEmail, setRoleConfirmEmail] = useState("");
  const [roleReason, setRoleReason] = useState("");
  const [roleError, setRoleError] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}/detail`);
      const u = data.data;
      setEditName(u.name || "");
      setEditCccd(u.cccd || "");
      setEditPhone(u.phone || "");
      setEditActive(u.isActive);
      return u as ApiRecord;
    },
  });

  const { data: addresses } = useQuery({
    queryKey: ["admin", "user-addresses", id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}/addresses`);
      return (data.data ?? []) as ApiRecord[];
    },
    enabled: !!user,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin", "user-orders", id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}/orders`);
      return (data.data ?? []) as ApiRecord[];
    },
    enabled: !!user,
  });

  const { data: viewedProducts } = useQuery({
    queryKey: ["admin", "user-viewed", id],
    queryFn: async () => {
      const { data } = await api.get(`/recently-viewed/user/${id}`);
      return (data.data ?? []) as ApiRecord[];
    },
    enabled: !!user,
  });

  const { data: persistedCart } = useQuery({
    queryKey: ["admin", "user-cart", id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/cart/users/${id}`);
      return data.data as {
        items: Array<{
          name: string;
          quantity: number;
          price: number;
          image?: string;
          variationName?: string;
          scaleName?: string;
          quoteItemId?: string;
        }>;
        updatedAt: string;
        reminderSentAt: string | null;
      } | null;
    },
    enabled: !!user,
  });

  const { data: wishlist } = useQuery({
    queryKey: ["admin", "user-wishlist", id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/wishlist/users/${id}`);
      return (data.data ?? []) as ApiRecord[];
    },
    enabled: !!user,
  });

  const cccdLocked = Boolean(user?.cccd);
  const mstLocked = Boolean(user?.mst);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const cccdDigits = editCccd.replace(/\D/g, "");
      const sendCccd = !cccdLocked && cccdDigits.length === 11;
      const { data } = await api.put(`/users/${id}`, {
        name: editName,

        ...(sendCccd ? { cccd: cccdDigits } : {}),
        phone: editPhone.replace(/\D/g, "") || undefined,
        isActive: editActive,
      });
      return data.data;
    },
    onSuccess: () => {
      setError("");
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      setError(extractError(err));
    },
  });

  const targetRole = user?.role === "ADMIN" ? "CUSTOMER" : "ADMIN";
  const targetIsPromote = targetRole === "ADMIN";
  const targetEmail = (user?.email as string | undefined) ?? "";
  const emailMatches =
    roleConfirmEmail.trim().toLowerCase() === targetEmail.toLowerCase();

  const roleMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put(`/users/${id}/role`, {
        role: targetRole,
        reason: roleReason.trim() || undefined,
      });
      return data.data;
    },
    onSuccess: () => {
      setRoleError("");
      setRoleDialog(false);
      setRoleConfirmEmail("");
      setRoleReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "user", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err) => {
      setRoleError(extractError(err, "admin-role-change"));
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  if (!user) {
    return <p className="text-muted-foreground">Không tìm thấy khách hàng.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/clients")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.name || "Không có tên"}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.isActive ? "default" : "secondary"}>
            {user.isActive ? "Hoạt động" : "Không hoạt động"}
          </Badge>
          <Badge variant="outline">{user.role as string}</Badge>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
              {!editMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditMode(true)}
                >
                  Sửa
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!editMode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{user.name || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                    {user.mst ? (
                      <span>
                        MST: {formatMst(user.mst as string)}
                        {user.companyName
                          ? ` — ${user.companyName as string}`
                          : ""}
                      </span>
                    ) : (
                      <span>
                        {user.cccd ? formatCccd(user.cccd as string) : "-"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      Vai trò:{" "}
                      <Badge variant="outline" className="ml-1">
                        {user.role as string}
                      </Badge>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>
                      Ngày tạo: {formatDate(user.createdAt as string)}
                    </span>
                  </div>
                  {user.lastLoginAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>
                        Ngày đăng nhập:{" "}
                        {formatDateTime(user.lastLoginAt as string)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tên khách hàng</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={user.email as string}
                      disabled
                      className="opacity-60"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Email không thể thay đổi
                    </p>
                  </div>
                  {mstLocked ? (
                    <div className="space-y-1">
                      <Label className="text-xs">MST</Label>
                      <Input
                        value={formatMst(user.mst as string)}
                        disabled
                        className="opacity-60"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Số giấy tờ không thể thay đổi
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">CCCD</Label>
                      <Input
                        value={cccdLocked ? formatCccd(editCccd) : editCccd}
                        onChange={(e) => {
                          if (cccdLocked) return;
                          setEditCccd(e.target.value);
                        }}
                        placeholder="000.000.000-00"
                        disabled={cccdLocked}
                        className={cccdLocked ? "opacity-60" : undefined}
                      />
                      {cccdLocked && (
                        <p className="text-[10px] text-muted-foreground">
                          Số giấy tờ không thể thay đổi
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Số điện thoại</Label>
                    <Input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="000 000 000"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="user-active"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="user-active" className="text-sm">
                      Khách hàng hoạt động
                    </Label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate()}
                      disabled={updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditMode(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {user._count?.orders ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Đơn hàng</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {formatCurrency(user.totalSpent ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Tổng chi tiêu</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Địa chỉ ({addresses?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!addresses?.length ? (
                <p className="text-sm text-muted-foreground">
                  Không có địa chỉ.
                </p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr: ApiRecord) => (
                    <div
                      key={addr.id as string}
                      className="border rounded-md px-3 py-2 text-sm bg-muted/30"
                    >
                      <p className="font-medium">
                        {(addr.label as string) || "Địa chỉ"}
                        {addr.isDefault ? " (Địa chỉ mặc định)" : ""}
                      </p>
                      <p className="text-muted-foreground">{addr.street}</p>
                      <p className="text-muted-foreground">
                        {addr.ward ? `${addr.ward}, ` : ""}
                        {addr.district}/{addr.province} — ZIP {addr.postalCode}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Đơn hàng ({orders?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!orders?.length ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có đơn hàng nào.
                </p>
              ) : (
                <div className="space-y-2">
                  {orders.map((order: ApiRecord) => (
                    <Link
                      key={order.id as string}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between border rounded-md px-4 py-3 text-sm bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <span className="font-mono text-xs font-medium">
                          #{order.number}
                        </span>
                        <span className="text-muted-foreground text-xs ml-2">
                          {formatDateTime(order.createdAt as string)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px]">
                          {statusLabel(order.status as string)}
                        </Badge>
                        <span className="font-medium text-xs">
                          {formatCurrency(order.total as number)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Giỏ hàng
                {persistedCart?.items?.length ? (
                  <Badge variant="outline" className="text-[10px]">
                    {persistedCart.items.length}{" "}
                    {persistedCart.items.length === 1 ? "sản phẩm" : "sản phẩm"}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!persistedCart?.items?.length ? (
                <p className="text-sm text-muted-foreground">Giỏ hàng trống.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Hoạt động cuối: {formatDateTime(persistedCart.updatedAt)}
                  </p>
                  {persistedCart.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="border rounded-md px-3 py-2 text-sm bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-14 w-14 object-contain rounded shrink-0 bg-background"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded bg-muted/50 flex items-center justify-center text-[9px] text-muted-foreground shrink-0">
                            Không có hình ảnh
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.variationName
                              ? `${item.variationName} · `
                              : ""}
                            {item.scaleName ? `${item.scaleName} · ` : ""}
                            {item.quoteItemId ? "Báo giá · " : ""}
                            {item.quantity}x {formatCurrency(item.price)}
                          </p>
                        </div>
                        <span className="font-medium text-xs whitespace-nowrap">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Danh sách yêu thích ({wishlist?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!wishlist?.length ? (
                <p className="text-sm text-muted-foreground">
                  Không có sản phẩm yêu thích.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {wishlist.map((wi: ApiRecord) => {
                    const product = wi.product as ApiRecord | undefined;
                    if (!product) return null;
                    const mainImg = (
                      product.images as ApiRecord[] | undefined
                    )?.[0];
                    const imgUrl = (mainImg?.mediaFile as ApiRecord | undefined)
                      ?.card as string | undefined;
                    return (
                      <Link
                        key={wi.id as string}
                        href={`/admin/products/${product.id}`}
                        className="border rounded-lg p-3 text-center bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={product.name as string}
                            className="h-20 w-full object-contain rounded mb-2"
                          />
                        ) : (
                          <div className="h-20 w-full rounded mb-2 bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground">
                            Không có hình ảnh
                          </div>
                        )}
                        <p className="text-xs font-medium truncate">
                          {product.name as string}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Vistos recentemente ({viewedProducts?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!viewedProducts?.length ? (
                <p className="text-sm text-muted-foreground">
                  Không có sản phẩm đã xem.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {viewedProducts.map((prod: ApiRecord) => {
                    const mainImg = (
                      prod.images as ApiRecord[] | undefined
                    )?.[0];
                    const imgUrl = (mainImg?.mediaFile as ApiRecord | undefined)
                      ?.card as string | undefined;
                    return (
                      <Link
                        key={prod.id as string}
                        href={`/admin/products/${prod.id}`}
                        className="border rounded-lg p-3 text-center bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={prod.name as string}
                            className="h-20 w-full object-contain rounded mb-2"
                          />
                        ) : (
                          <div className="h-20 w-full rounded mb-2 bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground">
                            Không có hình ảnh
                          </div>
                        )}
                        <p className="text-xs font-medium truncate">
                          {prod.name as string}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          {currentUser?.isOwner && currentUser.id !== (user?.id as string) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" /> Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Vai trò hiện tại
                    </p>
                    <Badge
                      variant={user?.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user?.role as string}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={targetIsPromote ? "default" : "destructive"}
                    onClick={() => {
                      setRoleError("");
                      setRoleConfirmEmail("");
                      setRoleReason("");
                      setRoleDialog(true);
                    }}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    {targetIsPromote ? "Tăng lên ADMIN" : "Hạ xuống CUSTOMER"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Owner có thể tăng/giảm vai trò. Mọi thay đổi sẽ được ghi lại
                  trong audit log.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Dialog
        open={roleDialog}
        onOpenChange={(open) => !open && setRoleDialog(false)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {targetIsPromote ? "Thăng chức lên ADMIN?" : "Hạ xuống CUSTOMER?"}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                {targetIsPromote
                  ? "Sẽ cấp quyền truy cập vào bảng quản trị. Hãy đảm bảo rằng bạn tin tưởng người dùng này."
                  : "Sẽ xóa tất cả quyền truy cập quản trị của tài khoản này."}
              </span>
              <span className="block font-mono text-xs bg-muted/40 rounded p-2">
                {targetEmail}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="confirm-email" className="text-xs">
                Nhập email người dùng để xác nhận:
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={roleConfirmEmail}
                onChange={(e) => setRoleConfirmEmail(e.target.value)}
                placeholder={targetEmail}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-reason" className="text-xs">
                Lý do (tùy chọn, sẽ được ghi lại):
              </Label>
              <Textarea
                id="role-reason"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder="Ví dụ: admin mới được tuyển"
                rows={2}
                maxLength={500}
              />
            </div>

            {roleError && (
              <p className="text-xs text-destructive">{roleError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>
              Hủy
            </Button>
            <Button
              variant={targetIsPromote ? "default" : "destructive"}
              disabled={!emailMatches || roleMutation.isPending}
              onClick={() => roleMutation.mutate()}
            >
              {roleMutation.isPending
                ? "Áp dụng..."
                : targetIsPromote
                  ? "Xác nhận tăng"
                  : "Xác nhận hạ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
