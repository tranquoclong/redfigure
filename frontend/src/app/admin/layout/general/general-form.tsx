"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ImagePicker } from "@/components/admin/image-picker";
import { ProductPicker } from "@/components/admin/product-picker";
import { revalidateGeneral } from "../_actions";

import { extractError } from "@/lib/extract-error";
interface GeneralPayload {
  siteName: string;
  siteTagline: string;
  ogImageUrl: string | null;
  loginFeaturedProductId: string | null;
  loginBadgeFeatured: string;
  loginBadgeFallback: string;
  loginFallbackTitle: string;
  loginSubtitle: string;
}

export function GeneralForm() {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [siteName, setSiteName] = useState("");
  const [siteTagline, setSiteTagline] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [loginFeaturedProductId, setLoginFeaturedProductId] = useState<
    string | null
  >(null);
  const [loginBadgeFeatured, setLoginBadgeFeatured] = useState("");
  const [loginBadgeFallback, setLoginBadgeFallback] = useState("");
  const [loginFallbackTitle, setLoginFallbackTitle] = useState("");
  const [loginSubtitle, setLoginSubtitle] = useState("");
  const [serverKey, setServerKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "site", "general"],
    queryFn: async () => {
      const { data } = await api.get<{ data: GeneralPayload }>("/site/general");
      return data.data;
    },
  });

  if (query.data) {
    const fresh = JSON.stringify(query.data);
    if (fresh !== serverKey) {
      setServerKey(fresh);
      setSiteName(query.data.siteName);
      setSiteTagline(query.data.siteTagline);
      setOgImageUrl(query.data.ogImageUrl ?? "");
      setLoginFeaturedProductId(query.data.loginFeaturedProductId ?? null);
      setLoginBadgeFeatured(query.data.loginBadgeFeatured ?? "");
      setLoginBadgeFallback(query.data.loginBadgeFallback ?? "");
      setLoginFallbackTitle(query.data.loginFallbackTitle ?? "");
      setLoginSubtitle(query.data.loginSubtitle ?? "");
    }
  }
  const hydrated = serverKey !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedOg = ogImageUrl.trim();
      const payload: GeneralPayload = {
        siteName,
        siteTagline,
        ogImageUrl: trimmedOg === "" ? null : trimmedOg,
        loginFeaturedProductId,
        loginBadgeFeatured,
        loginBadgeFallback,
        loginFallbackTitle,
        loginSubtitle,
      };
      await api.put("/admin/site/general", payload);

      try {
        await revalidateGeneral();
      } catch {}
    },
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractError(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cấu hình chung</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Tên trang web và tagline — dùng trong tiêu đề tab, email giao dịch và
          meta tag SEO.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {query.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
          </div>
        )}

        {hydrated && (
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Tên trang web</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Red Figure"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tagline</Label>
              <Input
                value={siteTagline}
                onChange={(e) => setSiteTagline(e.target.value)}
                placeholder="Mô hình cao cấp dành cho người sưu tầm."
              />
              <p className="text-[11px] text-muted-foreground">
                Xuất hiện trong tiêu đề tab trình duyệt và meta tag SEO.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hình ảnh Open Graph mặc định</Label>
              <ImagePicker
                value={ogImageUrl === "" ? null : ogImageUrl}
                onChange={(url) => setOgImageUrl(url ?? "")}
                variant="full"
                aspectRatio="1200x630"
                helperText="Được sử dụng trên Facebook, Zalo, X, LinkedIn và các mạng xã hội khác khi trang được chia sẻ không có ảnh. Định dạng được đề xuất: 1200×630 px."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Sản phẩm nổi bật trên trang đăng nhập
              </Label>
              <ProductPicker
                value={loginFeaturedProductId}
                onChange={setLoginFeaturedProductId}
                helperText="Hiển thị ở thanh bên phải của trang đăng nhập (/login và /register). Nếu không chọn sản phẩm nào, trang web sẽ sử dụng một sản phẩm ngẫu nhiên được đánh dấu là “Destaque”."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border/40 bg-muted/20 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Văn bản trên màn hình đăng nhập
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Hiển thị trên sản phẩm nổi bật trong /login và /register. Để
                  trống để ẩn phần tử.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nhãn · có sản phẩm</Label>
                <Input
                  value={loginBadgeFeatured}
                  onChange={(e) => setLoginBadgeFeatured(e.target.value)}
                  maxLength={40}
                  placeholder="NỔI BẬT"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nhãn trên cùng khi có sản phẩm được chọn hoặc fallback.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nhãn · không có sản phẩm</Label>
                <Input
                  value={loginBadgeFallback}
                  onChange={(e) => setLoginBadgeFallback(e.target.value)}
                  maxLength={40}
                  placeholder="GIỚI HẠN SỐ LƯỢNG"
                />
                <p className="text-[11px] text-muted-foreground">
                  Nhãn trên cùng khi trang sử dụng hình ảnh fallback.
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Tiêu đề fallback</Label>
                <Input
                  value={loginFallbackTitle}
                  onChange={(e) => setLoginFallbackTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Aurora · Cyber Vixen"
                />
                <p className="text-[11px] text-muted-foreground">
                  Hiển thị dưới dạng tiêu đề phụ trên sản phẩm trong /login và
                  /register.
                </p>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Phụ đề (lời kêu gọi đăng ký)</Label>
                <Input
                  value={loginSubtitle}
                  onChange={(e) => setLoginSubtitle(e.target.value)}
                  maxLength={160}
                  placeholder="Đăng ký để nhận phiếu giảm giá chào mừng"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dòng ngắn bên dưới tên sản phẩm / tiêu đề fallback.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !hydrated}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Lưu…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Lưu
              </>
            )}
          </Button>
          {saved && (
            <span className="text-sm text-green-500">
              Lưu! Trang web đã được cập nhật.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
