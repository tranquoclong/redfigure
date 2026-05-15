"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Save, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

import { extractError } from "@/lib/extract-error";
interface Me {
  id: string;
  email: string;
  name: string | null;
  role: string;
  cccd: string | null;
  phone: string | null;
}

export default function AdminProfilePage() {
  const qc = useQueryClient();
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get("/users/me");
      return (data.data ?? data) as Me;
    },
  });

  if (isLoading || !me) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thông tin cá nhân</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cập nhật thông tin đăng nhập và mật khẩu.
        </p>
      </div>

      <ProfileForm
        me={me}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["me"] });
          hydrateAuth();
        }}
      />

      <PasswordForm />
    </div>
  );
}

function ProfileForm({ me, onSaved }: { me: Me; onSaved: () => void }) {
  const [name, setName] = useState(me.name ?? "");
  const [email, setEmail] = useState(me.email);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.put("/users/me", {
        name: name.trim() || undefined,
        email: email.trim(),
      }),
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    },
    onError: (err) => setError(extractError(err)),
  });

  const dirty = name !== (me.name ?? "") || email !== me.email;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserIcon className="h-5 w-5" />
          Thông tin tài khoản
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {error && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="profile-name">Tên</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <p className="text-xs text-muted-foreground">
              Email usado để đăng nhập admin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!dirty || mutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
            {saved && <span className="text-sm text-green-600">Đã lưu!</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const strongEnough =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[@$!%*?&]/.test(newPassword);

  const mutation = useMutation({
    mutationFn: () =>
      api.put("/users/me/password", { currentPassword, newPassword }),
    onSuccess: () => {
      setError("");
      setCurrent("");
      setNew("");
      setConfirm("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setError(extractError(err)),
  });

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    !mismatch &&
    strongEnough &&
    !mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5" />
          Đổi mật khẩu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {error && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">Mật khẩu mới</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Tối thiểu 8 ký tự, với ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt
              (<code>@ $ ! % * ? &amp;</code>). Mật khẩu cũng được kiểm tra với
              cơ sở dữ liệu Have I Been Pwned — mật khẩu xuất hiện trong các vụ
              rò rỉ công khai sẽ bị từ chối.
            </p>
            {newPassword.length > 0 && !strongEnough && (
              <p className="text-xs text-destructive">
                Mật khẩu chưa đáp ứng tất cả các yêu cầu.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            {mismatch && (
              <p className="text-xs text-destructive">Mật khẩu không khớp.</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!canSubmit}>
              <Save className="h-4 w-4 mr-2" />
              {mutation.isPending ? "Đang đổi…" : "Đổi mật khẩu"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Đã đổi mật khẩu!</span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
