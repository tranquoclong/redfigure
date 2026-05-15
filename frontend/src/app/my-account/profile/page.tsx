"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useMyProfile } from "@/hooks/use-my-profile";

import { extractApiError } from "@/lib/extract-error";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const { data: profile } = useMyProfile();

  const cccdLocked = Boolean(profile?.cccd);
  const mstLocked = Boolean(profile?.mst);

  const [name, setName] = useState(user?.name ?? "");
  const [cccd, setCccd] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile?.cccd) {
      const d = profile.cccd.replace(/\D/g, "");
      if (d.length === 11) {
        setCccd(
          `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`,
        );
      }
    }
    if (profile?.phone) {
      const d = profile.phone.replace(/\D/g, "");
      if (d.length === 11)
        setPhone(`(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`);
      else if (d.length === 10)
        setPhone(`(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`);
    }
  }, [profile?.cccd, profile?.phone]);

  function formatMstMask(raw: string): string {
    const d = raw
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 14);
    if (d.length <= 12) return d;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const cccdDigits = cccd.replace(/\D/g, "");
      const phoneDigits = phone.replace(/\D/g, "");

      const sendCccd = !cccdLocked && cccdDigits.length === 11;
      const { data } = await api.put("/users/me", {
        name,
        ...(sendCccd ? { cccd: cccdDigits } : {}),
        ...(phoneDigits.length >= 10 ? { phone: phoneDigits } : {}),
      });

      setUser({ ...user!, name: data.data.name });

      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setMsg("Dữ liệu đã được cập nhật!");
    } catch (err) {
      setMsg(extractApiError(err, "Lỗi khi cập nhật"));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    try {
      await api.put("/users/me/password", { currentPassword, newPassword });
      setPwMsg("Mật khẩu đã được thay đổi thành công!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwMsg(extractApiError(err, "Lỗi khi thay đổi mật khẩu"));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Thông tin tài khoản</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Họ và tên</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mstLocked ? (
                <div className="space-y-2">
                  <Label htmlFor="mst">MST</Label>
                  <Input
                    id="mst"
                    value={formatMstMask(profile?.mst ?? "")}
                    disabled
                    className="opacity-70"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Thông tin đăng ký không thể thay đổi. Để sử dụng một MST
                    khác, vui lòng tạo một tài khoản mới.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="cccd">CCCD</Label>
                  <Input
                    id="cccd"
                    placeholder="000.000.000-00"
                    value={cccd}
                    onChange={(e) => {
                      if (cccdLocked) return;
                      const digits = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 9) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
                      } else if (digits.length > 6) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
                      } else if (digits.length > 3) {
                        formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
                      }
                      setCccd(formatted);
                    }}
                    maxLength={14}
                    disabled={cccdLocked}
                    className={cccdLocked ? "opacity-70" : undefined}
                  />
                  {cccdLocked && (
                    <p className="text-[10px] text-muted-foreground">
                      Thông tin đăng ký không thể thay đổi. Để sử dụng một CCCD
                      khác, vui lòng tạo một tài khoản mới.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  placeholder="000 000 000"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 11);
                    let formatted = digits;
                    if (digits.length > 6) {
                      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                    } else if (digits.length > 2) {
                      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                    }
                    setPhone(formatted);
                  }}
                  maxLength={15}
                />
              </div>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu lại"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thay đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={10}
              />
              <p className="text-xs text-muted-foreground">
                Tối thiểu 10 ký tự. Gợi ý: một cụm từ ngắn sẽ dễ nhớ hơn và an
                toàn hơn (ví dụ: &ldquo;thích mô hình 3d&rdquo;). Tránh các mật
                khẩu thông thường như &ldquo;12345678&rdquo; hoặc
                &ldquo;password123&rdquo;.
              </p>
            </div>
            {pwMsg && <p className="text-sm text-muted-foreground">{pwMsg}</p>}
            <Button type="submit">Thay đổi mật khẩu</Button>
          </form>
        </CardContent>
      </Card>

      <EmailPreferencesCard />
    </div>
  );
}

function EmailPreferencesCard() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [optOut, setOptOut] = useState(user?.emailMarketingOptOut ?? false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleToggle(checked: boolean) {
    setOptOut(checked);
    setSaving(true);
    setMsg("");
    try {
      const { data } = await api.put("/users/me/email-preferences", {
        emailMarketingOptOut: checked,
      });
      const updated = data.data ?? data;
      if (user)
        setUser({
          ...user,
          emailMarketingOptOut: updated.emailMarketingOptOut,
        });
      setMsg("Đã lưu tùy chọn!");
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      setOptOut(!checked);
      setMsg(extractApiError(err, "Lỗi khi lưu tùy chọn"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quản lý Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!optOut}
            onChange={(e) => handleToggle(!e.target.checked)}
            disabled={saving}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">Nhận email quảng cáo</div>
            <div className="text-xs text-muted-foreground mt-1">
              Bao gồm lời mời đánh giá sau khi giao hàng, nhắc nhở về giỏ hàng
              bị bỏ quên, ưu đãi và tin tức. Email đơn hàng (thanh toán, giao
              hàng, giao hàng) luôn được gửi.
            </div>
          </div>
        </label>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </CardContent>
    </Card>
  );
}
