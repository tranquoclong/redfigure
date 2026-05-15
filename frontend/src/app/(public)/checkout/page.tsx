"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShoppingBag,
  Lock,
  Plus,
  Check,
  Pencil,
  Truck,
  CreditCard,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type FreeShippingInfo } from "@/components/shared/shipping-calculator";
import { CheckoutStepper } from "@/components/checkout/checkout-stepper";
import { FreeShippingPromise } from "@/components/cart/free-shipping-promise";
import { api } from "@/lib/api-client";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { useMyProfile } from "@/hooks/use-my-profile";
import {
  ROUTES,
  formatCurrency,
  formatCccd,
  formatPhone,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { extractError } from "@/lib/extract-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  type GA4CheckoutItem,
} from "@/lib/ga4-events";
import { trackInitiateCheckout, type MetaCheckoutItem } from "@/lib/meta-pixel";

import {
  type VnProvince,
  type VnDistrict,
  type VnWard,
  vnFetchProvinces,
  vnFetchDistricts,
  vnFetchWards,
} from "@/lib/vn-address";

type PaymentMethodId = "cod" | "bank_transfer";

type PaymentMethodSummary = {
  id: PaymentMethodId;
  label: string;
  enabled: boolean;
  discount: number;
  gateway?: string;
  expirationMinutes?: number;
  bankInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
};

const DEFAULT_PAYMENT_METHODS: PaymentMethodSummary[] = [
  {
    id: "bank_transfer",
    label: "Chuyển khoản ngân hàng",
    enabled: true,
    discount: 0,
  },
  {
    id: "cod",
    label: "Thanh toán khi nhận hàng",
    enabled: true,
    discount: 0,
  },
];

interface CheckoutCartItem {
  productId?: string;
  variationId?: string;
  variationLabel?: string;
  variationName?: string;
  scaleName?: string;
  quoteItemId?: string;
  name: string;
  price: number;
  quantity: number;
}

function cartItemToGA4(item: CheckoutCartItem): GA4CheckoutItem {
  return {
    productId: item.productId ?? item.quoteItemId ?? "",
    variationId: item.variationId,
    variationName: item.variationName,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  };
}

function cartItemToMeta(item: CheckoutCartItem): MetaCheckoutItem {
  return {
    productId: item.productId ?? item.quoteItemId ?? "",
    variationId: item.variationId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  };
}

function isValidCccd(cccd: string): boolean {
  const digits = cccd.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

interface SavedAddress {
  id: string;
  name?: string;
  postalCode: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  isDefault?: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear, setCart } = useCartStore();
  const { user } = useAuthStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(() => {
    if (typeof window === "undefined") return "cod";
    const saved = localStorage.getItem("cartPaymentMethod");
    return saved === "cod" ? saved : "cod";
  });
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const [error, setError] = useState("");
  const [duplicateAccountOpen, setDuplicateAccountOpen] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const [methodsConfig, setMethodsConfig] = useState<PaymentMethodSummary[]>(
    DEFAULT_PAYMENT_METHODS,
  );

  useEffect(() => {
    if (!user && items.length > 0) {
      router.replace(ROUTES.checkoutIdentification);
    }
  }, [user, items.length, router]);

  useEffect(() => {
    api
      .get("/cart?revalidate=true")
      .then(({ data }) => {
        type RevItem = { outOfStock?: boolean };
        const revItems = (data.data.items ?? []) as RevItem[];
        const hasOutOfStock = revItems.some((i) => i.outOfStock === true);
        setCart(data.data.items, data.data.subtotal);
        if (hasOutOfStock) {
          router.push(`${ROUTES.cart}?stock_changed=1`);
        }
      })
      .catch(() => {})
      .finally(() => setCartLoading(false));

    api
      .get("/payments/methods")
      .then(({ data }) => {
        const list = (data.data ?? []) as PaymentMethodSummary[];
        if (list.length > 0) setMethodsConfig(list);
      })
      .catch(() => {});
  }, [setCart, router]);

  useEffect(() => {
    const current = methodsConfig.find((m) => m.id === paymentMethod);
    if (!current?.enabled) {
      const firstEnabled = methodsConfig.find((m) => m.enabled);
      if (firstEnabled) setPaymentMethod(firstEnabled.id);
    }
  }, [methodsConfig, paymentMethod]);

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current) return;
    if (cartLoading || items.length === 0) return;
    beginCheckoutFired.current = true;
    trackBeginCheckout(items.map(cartItemToGA4), subtotal);
    trackInitiateCheckout(items.map(cartItemToMeta), subtotal);
  }, [cartLoading, items, subtotal]);

  const [fullName, setFullName] = useState("");
  const [cccd, setCccd] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const { data: profile } = useMyProfile();
  const cccdLocked = !!profile?.cccd;

  useEffect(() => {
    if (user?.name) setFullName(user.name);
    if (user?.email) setEmail(user.email);
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (profile?.cccd) setCccd(profile.cccd);
    if (profile?.phone) setPhone(profile.phone);
  }, [profile?.cccd, profile?.phone]);

  const [freeShippingInfo, setFreeShippingInfo] =
    useState<FreeShippingInfo | null>(null);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [addressName, setAddressName] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);

  const [street, setStreet] = useState("");
  const [ward, setWard] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");

  const [vnProvinces, setVnProvinces] = useState<VnProvince[]>([]);
  const [vnDistricts, setVnDistricts] = useState<VnDistrict[]>([]);
  const [vnWards, setVnWards] = useState<VnWard[]>([]);

  const [vnSelProvince, setVnSelProvince] = useState<VnProvince | null>(null);
  const [vnSelDistrict, setVnSelDistrict] = useState<VnDistrict | null>(null);
  const [vnSelWard, setVnSelWard] = useState<VnWard | null>(null);

  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [vnApiError, setVnApiError] = useState("");

  // Load provinces once on mount
  useEffect(() => {
    vnFetchProvinces()
      .then(setVnProvinces)
      .catch(() => setVnApiError("Không thể tải danh sách tỉnh thành."))
      .finally(() => setLoadingProvinces(false));
  }, []);

  // Cascade: province → districts
  useEffect(() => {
    if (!vnSelProvince) {
      setVnDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    setVnSelDistrict(null);
    setVnSelWard(null);
    setVnWards([]);
    // sync province string immediately
    setProvince(vnSelProvince.name);
    setDistrict("");
    setWard("");
    vnFetchDistricts(vnSelProvince.code)
      .then(setVnDistricts)
      .catch(() => setVnApiError("Không thể tải danh sách quận huyện."))
      .finally(() => setLoadingDistricts(false));
  }, [vnSelProvince]);

  // Cascade: district → wards
  useEffect(() => {
    if (!vnSelDistrict) {
      setVnWards([]);
      return;
    }
    setLoadingWards(true);
    setVnSelWard(null);
    // sync district string
    setDistrict(vnSelDistrict.name);
    setWard("");
    vnFetchWards(vnSelDistrict.code)
      .then(setVnWards)
      .catch(() => setVnApiError("Không thể tải danh sách phường xã."))
      .finally(() => setLoadingWards(false));
  }, [vnSelDistrict]);

  useEffect(() => {
    setWard(vnSelWard?.name ?? "");
  }, [vnSelWard]);

  const syncCascadeFromStrings = useCallback(
    async (savedProvince: string, savedDistrict: string, savedWard: string) => {
      const prov = vnProvinces.find(
        (p) => p.name.toLowerCase() === savedProvince.toLowerCase(),
      );
      if (!prov) {
        setProvince(savedProvince);
        setDistrict(savedDistrict);
        setWard(savedWard);
        return;
      }
      setVnSelProvince(prov);
      setProvince(prov.name);

      setLoadingDistricts(true);
      try {
        const dists = await vnFetchDistricts(prov.code);
        setVnDistricts(dists);
        const dist = dists.find(
          (d) => d.name.toLowerCase() === savedDistrict.toLowerCase(),
        );
        if (!dist) {
          setDistrict(savedDistrict);
          setWard(savedWard);
          return;
        }
        setVnSelDistrict(dist);
        setDistrict(dist.name);

        setLoadingWards(true);
        const wards = await vnFetchWards(dist.code);
        setVnWards(wards);
        const w = wards.find(
          (w) => w.name.toLowerCase() === savedWard.toLowerCase(),
        );
        setVnSelWard(w ?? null);
        setWard(w ? w.name : savedWard);
      } catch {
        setDistrict(savedDistrict);
        setWard(savedWard);
      } finally {
        setLoadingDistricts(false);
        setLoadingWards(false);
      }
    },
    [vnProvinces],
  );

  const selectSavedAddress = useCallback(
    (addr: SavedAddress) => {
      setSelectedAddressId(addr.id);
      setAddressName(addr.name ?? "");
      setStreet(addr.street);

      // const newCep = addr.postalCode.replace(/\D/g, "");
      // const savedCep =
      //   typeof window !== "undefined"
      //     ? (localStorage.getItem("cartShippingCep") ?? "").replace(/\D/g, "")
      //     : "";
      // if (newCep !== savedCep) setSelectedShipping(null);

      if (vnProvinces.length > 0) {
        syncCascadeFromStrings(addr.province, addr.district, addr.ward);
      } else {
        setProvince(addr.province);
        setDistrict(addr.district);
        setWard(addr.ward);
      }
    },
    [vnProvinces, syncCascadeFromStrings],
  );

  useEffect(() => {
    api
      .get("/addresses")
      .then(({ data }) => {
        const addrs = data.data ?? [];
        setSavedAddresses(addrs);
        if (addrs.length > 0) {
          setAddressMode("saved");
          const defaultAddr =
            addrs.find((a: SavedAddress) => a.isDefault) ?? addrs[0];
          selectSavedAddress(defaultAddr);
        }
      })
      .catch(() => {});
  }, []);
  const didSyncOnLoad = useRef(false);
  useEffect(() => {
    if (vnProvinces.length === 0 || didSyncOnLoad.current) return;
    if (province) {
      didSyncOnLoad.current = true;
      syncCascadeFromStrings(province, district, ward);
    }
  }, [vnProvinces]);

  const handleAddNew = () => {
    setAddressMode("new");
    setSelectedAddressId(null);
    setAddressName("");
    setStreet("");
    setVnSelProvince(null);
    setVnSelDistrict(null);
    setVnSelWard(null);
    setVnDistricts([]);
    setVnWards([]);
    setProvince("");
    setDistrict("");
    setWard("");
  };

  const shippingCost = 0;
  const currentMethodCfg = methodsConfig.find((m) => m.id === paymentMethod);
  const discountPercent = currentMethodCfg?.discount ?? 0;
  const paymentDiscount =
    Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const total =
    Math.round((subtotal - paymentDiscount + shippingCost) * 100) / 100;
  const enabledPaymentMethods = methodsConfig.filter((m) => m.enabled);
  console.log("enabledPaymentMethods", enabledPaymentMethods);
  async function handlePlaceOrder() {
    if (!fullName.trim()) {
      setError("Vui lòng nhập họ tên đầy đủ.");
      return;
    }
    // if (!isValidCccd(cccd)) {
    //   setError("Số CCCD không hợp lệ.");
    //   return;
    // }
    if (!phone.replace(/\D/g, "") || phone.replace(/\D/g, "").length < 10) {
      setError("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    if (!street || !ward || !district || !province) {
      setError("Vui lòng điền đầy đủ địa chỉ.");
      return;
    }

    setError("");
    setLoading(true);

    const cccdDigits = cccd.replace(/\D/g, "");
    const phoneDigits = phone.replace(/\D/g, "");
    const shippingAddress = {
      recipient: fullName.trim(),
      street,
      ward,
      district,
      province,
    };

    try {
      try {
        await api.put("/users/me", {
          name: fullName.trim(),
          cccd: cccdDigits,
          phone: phoneDigits,
        });
      } catch (profileErr) {
        const errCode = (
          profileErr as { response?: { data?: { errorCode?: string } } }
        )?.response?.data?.errorCode;
        if (errCode === "DUPLICATE_USER_FIELD") {
          setDuplicateAccountOpen(true);
          setLoading(false);
          return;
        }
        setError(extractError(profileErr));
        setLoading(false);
        return;
      }

      let couponCodes: string[] = [];
      if (typeof window !== "undefined") {
        const multi = localStorage.getItem("cartCoupons");
        if (multi) {
          try {
            const parsed = JSON.parse(multi);
            if (Array.isArray(parsed))
              couponCodes = parsed
                .map((c: { code?: string }) => c.code)
                .filter((c): c is string => typeof c === "string");
          } catch {}
        } else {
          const legacy = localStorage.getItem("cartCoupon");
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy) as { code?: string };
              if (parsed.code) couponCodes = [parsed.code];
            } catch {}
          }
        }
      }

      const { data: orderData } = await api.post(
        "/orders",
        {
          items: items.map((i) => ({
            productId: i.productId,
            variationId: i.variationId,
            scaleId: i.scaleId,
            quoteItemId: i.quoteItemId,
            quantity: i.quantity,
            ...(i.freeGiftId ? { freeGiftId: i.freeGiftId } : {}),
          })),
          shipping: 0,
          paymentMethod,
          shippingAddress,
          couponCodes,
        },
        { headers: { "Idempotency-Key": idempotencyKeyRef.current } },
      );

      const orderId = orderData.data?.id ?? orderData.id;
      if (saveAddress && addressMode === "new") {
        api
          .post("/addresses", {
            name: addressName.trim() || undefined,
            street,
            ward,
            district,
            province,
          })
          .catch((err) => console.warn("[checkout] save address failed:", err));
      }
      api.delete("/cart").catch(() => {});
      localStorage.removeItem("cartShipping");
      localStorage.removeItem("cartCoupon");
      localStorage.removeItem("cartCoupons");
      localStorage.removeItem("cartShippingCep");
      localStorage.removeItem("cartPaymentMethod");
      idempotencyKeyRef.current = crypto.randomUUID();
      // router.push(`/order/payment/${orderId}`);
      router.push(`/my-account/orders/${orderId}`);
      setTimeout(() => clear(), 100);
    } catch (err) {
      const resp = (
        err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      setError(resp?.error?.message ?? resp?.message ?? "Lỗi xử lý thanh toán");
    } finally {
      setLoading(false);
    }
  }

  if (cartLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center text-white/55">
        Đang tải…
      </div>
    );
  }
  if (!user) return null;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumb />
        <CheckoutStepper currentStep={3} className="mb-10 mt-6" />
        <div className="rounded-3xl border border-purple/25 bg-white/[0.02] p-16 text-center backdrop-blur-sm">
          <ShoppingBag className="mx-auto h-14 w-14 text-white/20" />
          <p className="mt-6 text-lg text-white/72">Giỏ hàng trống.</p>
          <Link href={ROUTES.products} className="mt-6 inline-block">
            <Button variant="neon" className="rounded-full px-8 py-6 text-xs">
              XEM SẢN PHẨM →
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const cartProducts = items.map((i) => ({
    productId: i.productId,
    variationId: i.variationId,
    quoteItemId: i.quoteItemId,
    quantity: i.quantity,
  }));

  const initials = getInitials(user.name, user.email);
  const showNameField = !user.name;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumb />
      <CheckoutStepper currentStep={3} className="mb-9 mt-6" />

      <div className="grid items-start gap-8 pb-16 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <Section
            num={1}
            done
            title="Thông tin cá nhân"
            subtitle="Xác nhận thông tin"
          >
            <div className="flex items-center gap-3.5 rounded-xl border border-lime/35 bg-lime/[0.06] px-4 py-3">
              <div
                className="grid size-9 flex-shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-white"
                style={{ background: "var(--grad-cta)" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                {user.name && (
                  <div className="font-display text-sm font-semibold text-white">
                    {user.name}
                  </div>
                )}
                <div className="truncate font-mono text-[11px] tracking-[0.04em] text-white/55">
                  {user.email}
                </div>
              </div>
              <Check
                className="size-5 flex-shrink-0 text-lime"
                strokeWidth={2.5}
              />
            </div>

            <div className={cn("mt-3.5 grid gap-3", "sm:grid-cols-2")}>
              {showNameField && (
                <FormField label="Họ và tên" required className="sm:col-span-2">
                  <FormInput
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Họ và tên"
                    maxLength={80}
                    autoComplete="name"
                  />
                </FormField>
              )}

              <FormField
                label="CCCD"
                required={!cccdLocked}
                meta={cccdLocked ? "đã đăng ký" : undefined}
              >
                {cccdLocked ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/45 px-3.5 py-3">
                    <span className="flex-1 font-mono text-[13px] tracking-[0.04em] text-white/72">
                      {cccd}
                    </span>
                    <Lock
                      className="size-3 text-white/55"
                      strokeWidth={2}
                      aria-label="Không thể chỉnh sửa"
                    />
                  </div>
                ) : (
                  <FormInput
                    value={cccd}
                    onChange={(e) => setCccd(formatCccd(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={15}
                    inputMode="numeric"
                  />
                )}
              </FormField>

              <FormField label="Điện thoại" required>
                <FormInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="000 000 000"
                  maxLength={15}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </FormField>
            </div>
          </Section>
          <Section
            num={2}
            title="Địa chỉ nhận hàng"
            subtitle="Giao hàng an toàn và nhanh chóng"
          >
            {savedAddresses.length > 0 && addressMode === "saved" && (
              <>
                <div className="flex flex-col gap-2.5">
                  {savedAddresses.map((addr) => {
                    const isSel = selectedAddressId === addr.id;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => selectSavedAddress(addr)}
                        className={cn(
                          "grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 rounded-xl border bg-black/30 px-4 py-3.5 text-left transition-all duration-[var(--dur-base)]",
                          isSel
                            ? "border-cyan bg-cyan/[0.06] [box-shadow:var(--glow-cyan-sm)]"
                            : "border-white/10 hover:border-cyan/45",
                        )}
                      >
                        <Radio selected={isSel} />
                        <div className="min-w-0 flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[13px] font-semibold uppercase text-white">
                              {addr.name?.trim() ||
                                `Địa chỉ ${addr.id.slice(0, 4)}`}
                            </span>
                            {addr.isDefault && (
                              <span className="rounded border border-cyan/35 bg-cyan/[0.1] px-1.5 py-[2px] font-mono text-[9px] uppercase tracking-[0.1em] text-cyan">
                                Mặc định
                              </span>
                            )}
                          </div>
                          <span className="truncate font-sans text-xs leading-snug text-white/72">
                            {addr.street} — {addr.ward} · {addr.district} ·{" "}
                            {addr.province}
                          </span>
                        </div>
                        <Pencil className="size-3 self-center text-cyan" />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddNew}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-transparent px-3 py-3 font-display text-xs uppercase tracking-[0.1em] text-white/72 transition-colors hover:border-cyan/55 hover:text-cyan"
                >
                  <Plus className="size-4" /> Thêm địa chỉ mới
                </button>
              </>
            )}

            {(addressMode === "new" || savedAddresses.length === 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {savedAddresses.length > 0 && addressMode === "new" && (
                  <button
                    type="button"
                    onClick={() => setAddressMode("saved")}
                    className="mb-1 flex w-fit items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-cyan/90 transition-colors hover:text-cyan sm:col-span-2"
                  >
                    <ArrowLeft className="size-3.5" /> Quay về chọn địa chỉ
                  </button>
                )}
                <FormField
                  label="Tên địa chỉ (tùy chọn)"
                  className="sm:col-span-2"
                >
                  <FormInput
                    value={addressName}
                    onChange={(e) => setAddressName(e.target.value)}
                    placeholder="Ví dụ: nhà, văn phòng, căn hộ..."
                    maxLength={40}
                  />
                </FormField>
                <FormField
                  label="Tỉnh / Thành phố"
                  required
                  className="sm:col-span-2"
                >
                  {vnApiError && (
                    <p className="mb-1.5 font-mono text-[10px] text-magenta">
                      {vnApiError}
                    </p>
                  )}
                  <div className="relative">
                    <select
                      value={vnSelProvince?.code ?? ""}
                      onChange={(e) => {
                        const found = vnProvinces.find(
                          (p) => p.code === Number(e.target.value),
                        );
                        setVnSelProvince(found ?? null);
                      }}
                      disabled={loadingProvinces}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 pr-9 font-mono text-[13px] text-white outline-none transition-all duration-[var(--dur-base)] placeholder:text-white/35 focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <option value="" className="bg-ink">
                        {loadingProvinces
                          ? "Đang tải…"
                          : "— Chọn tỉnh / thành phố —"}
                      </option>
                      {vnProvinces.map((p) => (
                        <option key={p.code} value={p.code} className="bg-ink">
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/55">
                      {loadingProvinces ? "⏳" : "▾"}
                    </span>
                  </div>
                </FormField>
                <FormField label="Quận / Huyện" required>
                  <div className="relative">
                    <select
                      value={vnSelDistrict?.code ?? ""}
                      onChange={(e) => {
                        const found = vnDistricts.find(
                          (d) => d.code === Number(e.target.value),
                        );
                        setVnSelDistrict(found ?? null);
                      }}
                      disabled={!vnSelProvince || loadingDistricts}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 pr-9 font-mono text-[13px] text-white outline-none transition-all duration-[var(--dur-base)] focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <option value="" className="bg-ink">
                        {loadingDistricts
                          ? "Đang tải…"
                          : "— Chọn quận / huyện —"}
                      </option>
                      {vnDistricts.map((d) => (
                        <option key={d.code} value={d.code} className="bg-ink">
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/55">
                      {loadingDistricts ? "⏳" : "▾"}
                    </span>
                  </div>
                </FormField>
                <FormField label="Phường / Xã" required>
                  <div className="relative">
                    <select
                      value={vnSelWard?.code ?? ""}
                      onChange={(e) => {
                        const found = vnWards.find(
                          (w) => w.code === Number(e.target.value),
                        );
                        setVnSelWard(found ?? null);
                      }}
                      disabled={!vnSelDistrict || loadingWards}
                      className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 pr-9 font-mono text-[13px] text-white outline-none transition-all duration-[var(--dur-base)] focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <option value="" className="bg-ink">
                        {loadingWards ? "Đang tải…" : "— Chọn phường / xã —"}
                      </option>
                      {vnWards.map((w) => (
                        <option key={w.code} value={w.code} className="bg-ink">
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-white/55">
                      {loadingWards ? "⏳" : "▾"}
                    </span>
                  </div>
                </FormField>
                <FormField
                  label="Số nhà, tên đường"
                  required
                  className="sm:col-span-2"
                >
                  <FormInput
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Ví dụ: 123 Nguyễn Huệ"
                    maxLength={200}
                    autoComplete="street-address"
                  />
                </FormField>
                {province && district && ward && street.trim() && (
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-cyan/[0.18] bg-cyan/[0.04] px-3.5 py-2.5">
                    <span className="font-mono text-[10px] tracking-[0.06em] text-cyan">
                      📍
                    </span>
                    <span className="font-mono text-[11px] leading-snug text-white/72">
                      {street}, {ward}, {district}, {province}
                    </span>
                  </div>
                )}
                <label className="mt-1 flex cursor-pointer items-center gap-2.5 sm:col-span-2">
                  <span
                    className={cn(
                      "grid size-[18px] place-items-center rounded border-[1.5px] transition-colors",
                      saveAddress
                        ? "border-cyan bg-cyan"
                        : "border-white/55 bg-transparent",
                    )}
                    aria-hidden
                  >
                    {saveAddress && (
                      <Check className="size-3 text-black" strokeWidth={3} />
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="font-sans text-[13px] text-white/72">
                    Lưu địa chỉ này cho lần sau
                  </span>
                </label>
              </div>
            )}
          </Section>

          <Section
            num={3}
            title="Phương thức thanh toán"
            subtitle="Thanh toán khi nhận hàng (COD) và Chuyển khoản ngân hàng được giảm giá"
          >
            <div className="mb-4 grid gap-2.5 sm:grid-cols-3">
              {enabledPaymentMethods.map((method) => {
                const isSel = paymentMethod === method.id;
                const hasDiscount = method.discount > 0;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);
                      try {
                        if (typeof window !== "undefined")
                          localStorage.setItem("cartPaymentMethod", method.id);
                      } catch {}
                      trackAddPaymentInfo(
                        items.map(cartItemToGA4),
                        total,
                        method.id,
                      );
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border bg-black/30 px-3 py-4 text-center transition-all duration-[var(--dur-base)]",
                      isSel
                        ? "border-cyan bg-cyan/[0.06] [box-shadow:var(--glow-cyan-sm)]"
                        : "border-white/10 hover:border-cyan/45",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center",
                        isSel ? "text-cyan" : "text-white",
                      )}
                    >
                      {method.id === "cod" ? (
                        <Truck className="size-8" strokeWidth={1.8} />
                      ) : (
                        <CreditCard className="size-8" strokeWidth={1.8} />
                      )}
                    </span>
                    <span className="font-display text-[13px] tracking-[0.06em] text-white">
                      {method.id === "cod" ? "COD" : "Bank"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-[2px] font-mono text-[9px] tracking-[0.08em]",
                        hasDiscount
                          ? "bg-lime/[0.14] text-lime"
                          : "bg-cyan/[0.1] text-cyan",
                      )}
                    >
                      {method.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/[0.25] p-4">
              {paymentMethod === "bank_transfer" ? (
                <SepayDetail
                  discountPercent={discountPercent}
                  expirationMinutes={
                    currentMethodCfg?.expirationMinutes ?? 4320
                  }
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  <p className="text-[13px] leading-relaxed text-white/72">
                    Bạn sẽ thanh toán bằng tiền mặt khi đơn hàng được giao đến
                    địa chỉ của bạn.
                  </p>
                  <p className="inline-flex items-center gap-2 font-mono text-[11px] text-white/55">
                    <Check className="size-3.5 text-lime" strokeWidth={2.5} />{" "}
                    Thanh toán khi nhận hàng
                  </p>
                  <p className="inline-flex items-center gap-2 font-mono text-[11px] text-magenta">
                    <span
                      aria-hidden
                      className="grid size-3.5 place-items-center rounded-full border border-magenta text-[9px] font-bold"
                    >
                      !
                    </span>
                    Vui lòng chuẩn bị sẵn số tiền tương ứng.
                  </p>
                </div>
              )}
            </div>
          </Section>
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.015] p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-white">
                Đơn hàng
              </h3>
              <Link
                href={ROUTES.cart}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-cyan hover:text-white"
              >
                Xem giỏ hàng →
              </Link>
            </div>

            <div className="max-h-72 space-y-0 overflow-y-auto pr-1 -mr-1">
              {items.map((item) => {
                const key = `${item.productId}-${item.variationId ?? ""}-${item.scaleId ?? ""}`;
                const chips: string[] = [];
                if (item.scaleName) chips.push(`Kích thước: ${item.scaleName}`);
                if (item.variationName) {
                  const label = item.variationLabel ?? "Phiên bản";
                  chips.push(`${label}: ${item.variationName}`);
                }
                const isMultiQty = item.quantity > 1;
                return (
                  <div
                    key={key}
                    className="grid grid-cols-[56px_1fr_auto] gap-3 border-b border-white/[0.04] py-2.5 last:border-b-0"
                  >
                    <div className="size-14 overflow-hidden rounded-md bg-black">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              "radial-gradient(circle at 50% 30%, rgba(184,41,255,0.45), transparent 60%), #0c0322",
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 self-center">
                      <p className="truncate font-sans text-[13px] font-medium leading-tight text-white">
                        {item.name}
                      </p>
                      {chips.length > 0 && (
                        <p className="mt-1 truncate font-mono text-[10px] tracking-[0.04em] text-white/55">
                          {chips.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="self-center whitespace-nowrap text-right">
                      <p className="font-display text-[13px] font-bold text-white">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                      {isMultiQty && (
                        <p className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-white/55">
                          {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex flex-col gap-2.5 border-t border-white/10 pt-3.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-white/72">
                  Tổng ({itemCount} sản phẩm)
                </span>
                <span className="font-mono text-white">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {paymentDiscount > 0 && (
                <div className="flex items-center justify-between text-lime">
                  <span>Giảm giá</span>
                  <span className="font-mono">
                    − {formatCurrency(paymentDiscount)}
                  </span>
                </div>
              )}
              <hr className="my-1 border-white/10" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-white">
                  Tổng cộng
                </span>
                <div className="text-right">
                  <div className="font-display text-3xl font-extrabold leading-none tracking-[0.005em] text-white">
                    {formatCurrency(total)}
                  </div>
                  <div className="mt-1 font-mono text-[11px] tracking-[0.08em] text-cyan">
                    thanh toán
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-magenta/40 bg-magenta/10 px-4 py-3 text-center text-sm text-magenta">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={loading}
              className="mt-4 flex h-14 w-full items-center justify-center gap-3 rounded-full font-display text-sm font-extrabold uppercase tracking-[0.1em] text-white transition hover:brightness-110 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: "var(--grad-cta)",
                boxShadow: "var(--glow-purple)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> ĐANG THANH TOÁN…
                </>
              ) : (
                <>Thanh toán · {formatCurrency(total)}</>
              )}
            </button>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-3.5 font-mono text-[10px] tracking-[0.08em] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3 text-lime" /> SSL 256-bit
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shield className="size-3 text-lime" /> Đã bảo vệ
              </span>
            </div>
          </div>
        </aside>
      </div>

      <Dialog
        open={duplicateAccountOpen}
        onOpenChange={setDuplicateAccountOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thông tin đã tồn tại</DialogTitle>
            <DialogDescription>
              Thông tin được cung cấp đã được liên kết với một tài khoản. Vui
              lòng đăng nhập vào tài khoản hiện có để tiếp tục mua hàng.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateAccountOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `${ROUTES.login}?next=${encodeURIComponent("/checkout")}`,
                )
              }
            >
              Đăng nhập
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav className="mb-3 font-mono text-[11px] lowercase tracking-[0.08em] text-white/55">
      <Link href={ROUTES.home} className="hover:text-cyan">
        Trang chủ
      </Link>
      <span className="mx-2 text-white/35">·</span>
      <Link href={ROUTES.cart} className="hover:text-cyan">
        giỏ hàng
      </Link>
      <span className="mx-2 text-white/35">·</span>
      <span className="text-cyan">thanh toán</span>
    </nav>
  );
}

function Section({
  num,
  done = false,
  title,
  subtitle,
  children,
}: {
  num: number;
  done?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-white/[0.015] p-6 transition-all duration-[var(--dur-base)]",
        done ? "border-white/10" : "border-white/10",
      )}
    >
      <header className="mb-4 flex items-center gap-3.5">
        <span
          className={cn(
            "grid size-8 flex-shrink-0 place-items-center rounded-full border font-display text-xs font-bold",
            done
              ? "border-lime/35 bg-lime/[0.14] text-lime"
              : "border-magenta/35 bg-magenta/[0.14] text-magenta",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={2.5} /> : num}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight tracking-[0.01em] text-white">
            {title}
          </h2>
          {subtitle && (
            <span className="mt-0.5 block font-mono text-[11px] tracking-[0.06em] text-white/55">
              {subtitle}
            </span>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function FormField({
  label,
  required,
  meta,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  meta?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[10px] uppercase tracking-[0.12em] text-white/72">
        {label}
        {required && <span className="ml-0.5 text-magenta"> *</span>}
        {meta && (
          <span className="ml-1.5 font-mono text-[9px] tracking-[0.04em] text-white/55">
            {meta}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function FormInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 font-mono text-[13px] text-white outline-none transition-all duration-[var(--dur-base)] placeholder:text-white/35 focus:border-cyan/55 focus:[box-shadow:var(--glow-cyan-sm)]",
        className,
      )}
      {...props}
    />
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[18px] place-items-center self-center rounded-full border-[1.5px] transition-colors",
        selected ? "border-cyan" : "border-white/45",
      )}
    >
      {selected && (
        <span
          className="size-2 rounded-full bg-cyan"
          style={{ boxShadow: "0 0 6px var(--color-cyan, #00f0ff)" }}
        />
      )}
    </span>
  );
}

function SepayDetail({
  discountPercent,
  expirationMinutes,
}: {
  discountPercent: number;
  expirationMinutes: number;
}) {
  const days = Math.round(expirationMinutes / 60 / 24);
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] leading-relaxed text-white/72">
        Sau khi xác nhận đơn hàng, chúng tôi sẽ tạo mã thanh toán và gửi qua
        email — bạn cũng có thể in/copy mã ở đây.
      </p>
      {discountPercent > 0 && (
        <p className="inline-flex items-center gap-2 font-mono text-[11px] text-white/55">
          <Check className="size-3.5 text-lime" strokeWidth={2.5} /> Đã áp dụng
          giảm giá {discountPercent}%
        </p>
      )}
      <p className="inline-flex items-center gap-2 font-mono text-[11px] text-white/55">
        <Check className="size-3.5 text-lime" strokeWidth={2.5} />
        Hết hạn sau: {days <= 1 ? "1 ngày" : `${days} ngày`} · thanh toán trong
        vòng 3 ngày làm việc
      </p>
      <p className="inline-flex items-center gap-2 font-mono text-[11px] text-magenta">
        <span
          aria-hidden
          className="grid size-3.5 place-items-center rounded-full border border-magenta text-[9px] font-bold"
        >
          !
        </span>
        Đơn hàng được xử lý sau khi thanh toán được xác nhận.
      </p>
    </div>
  );
}
