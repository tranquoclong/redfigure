"use client";
import type { ApiRecord } from "@/types/api";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api-client";

import {
  type VnProvince,
  type VnDistrict,
  type VnWard,
  vnFetchProvinces,
  vnFetchDistricts,
  vnFetchWards,
} from "@/lib/vn-address";
function AddressForm({
  onSubmit,
  onCancel,
  defaults,
  submitLabel,
  loading,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  defaults?: ApiRecord;
  submitLabel: string;
  loading: boolean;
}) {
  const [provinces, setProvinces] = useState<VnProvince[]>([]);
  const [districts, setDistricts] = useState<VnDistrict[]>([]);
  const [wards, setWards] = useState<VnWard[]>([]);

  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | "">(
    "",
  );
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | "">(
    "",
  );
  const [selectedWardCode, setSelectedWardCode] = useState<number | "">("");

  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const provs = await vnFetchProvinces();
        if (!active) return;
        setProvinces(provs);
        setLoadingProvinces(false);

        if (defaults?.province) {
          const p = provs.find((x) => x.name === defaults.province);
          if (p) {
            setSelectedProvinceCode(p.code);

            setLoadingDistricts(true);
            const dists = await vnFetchDistricts(p.code);
            if (!active) return;
            setDistricts(dists);
            setLoadingDistricts(false);

            if (defaults?.district) {
              const d = dists.find((x) => x.name === defaults.district);
              if (d) {
                setSelectedDistrictCode(d.code);

                setLoadingWards(true);
                const ws = await vnFetchWards(d.code);
                if (!active) return;
                setWards(ws);
                setLoadingWards(false);

                if (defaults?.ward) {
                  const w = ws.find((x) => x.name === defaults.ward);
                  if (w) setSelectedWardCode(w.code);
                }
              }
            }
          }
        }
      } catch (err) {
        if (active) setLoadingProvinces(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [defaults]);

  const handleProvinceChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const code = Number(e.target.value);
    setSelectedProvinceCode(code || "");
    setSelectedDistrictCode("");
    setSelectedWardCode("");
    setDistricts([]);
    setWards([]);
    if (code) {
      setLoadingDistricts(true);
      const dists = await vnFetchDistricts(code);
      setDistricts(dists);
      setLoadingDistricts(false);
    }
  };

  const handleDistrictChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const code = Number(e.target.value);
    setSelectedDistrictCode(code || "");
    setSelectedWardCode("");
    setWards([]);
    if (code) {
      setLoadingWards(true);
      const ws = await vnFetchWards(code);
      setWards(ws);
      setLoadingWards(false);
    }
  };

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedWardCode(Number(e.target.value) || "");
  };

  const selectedProvinceName =
    provinces.find((p) => p.code === selectedProvinceCode)?.name || "";
  const selectedDistrictName =
    districts.find((d) => d.code === selectedDistrictCode)?.name || "";
  const selectedWardName =
    wards.find((w) => w.code === selectedWardCode)?.name || "";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="province" value={selectedProvinceName} />
      <input type="hidden" name="district" value={selectedDistrictName} />
      <input type="hidden" name="ward" value={selectedWardName} />

      <div className="space-y-1">
        <Label className="text-xs">Tên địa chỉ (tùy chọn)</Label>
        <Input
          name="name"
          placeholder="Ví dụ: nhà, văn phòng, căn hộ..."
          maxLength={40}
          defaultValue={defaults?.name ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tỉnh / Thành phố</Label>
          <select
            value={selectedProvinceCode}
            onChange={handleProvinceChange}
            required
            disabled={loadingProvinces}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">
              {loadingProvinces ? "Đang tải..." : "— Chọn tỉnh / thành phố —"}
            </option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quận / Huyện</Label>
          <select
            value={selectedDistrictCode}
            onChange={handleDistrictChange}
            required
            disabled={!selectedProvinceCode || loadingDistricts}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">
              {loadingDistricts ? "Đang tải..." : "— Chọn quận / huyện —"}
            </option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Phường / Xã</Label>
          <select
            value={selectedWardCode}
            onChange={handleWardChange}
            required
            disabled={!selectedDistrictCode || loadingWards}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">
              {loadingWards ? "Đang tải..." : "— Chọn phường / xã —"}
            </option>
            {wards.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Số nhà, tên đường</Label>
          <Input
            name="street"
            required
            maxLength={200}
            placeholder="Ví dụ: 123 Nguyễn Huệ"
            defaultValue={defaults?.street ?? ""}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:bg-purple/80 transition-colors disabled:opacity-50"
        >
          {loading ? "Đang lưu..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => {
      const { data } = await api.get("/addresses");
      return data.data;
    },
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ApiRecord) => api.post("/addresses", data),
    onSuccess: () => {
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: ApiRecord & { id: string }) =>
      api.put(`/addresses/${id}`, data),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/addresses/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const isFirst = !addresses?.length;
    createMutation.mutate({
      name: (fd.get("name") as string)?.trim() || undefined,
      street: fd.get("street"),
      district: fd.get("district"),
      ward: fd.get("ward"),
      province: fd.get("province"),
      isDefault: isFirst,
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const fd = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingId,
      name: (fd.get("name") as string)?.trim() || undefined,
      street: fd.get("street"),
      district: fd.get("district"),
      ward: fd.get("ward"),
      province: fd.get("province"),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Địa chỉ</h1>
        <Button
          size="sm"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm mới
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Thêm địa chỉ mới</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              submitLabel="Thêm"
              loading={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Đang tải...</p>
      ) : !addresses?.length ? (
        <EmptyState
          title="Chưa có địa chỉ"
          description="Thêm địa chỉ giao hàng."
        />
      ) : (
        <div className="space-y-3">
          {addresses.map((addr: ApiRecord) => (
            <div
              key={addr.id}
              className={`border rounded-lg p-4 ${
                addr.isDefault ? "border-primary bg-primary/5" : ""
              }`}
            >
              {editingId === addr.id ? (
                <AddressForm
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingId(null)}
                  defaults={addr}
                  submitLabel="Cập nhật"
                  loading={updateMutation.isPending}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {addr.name && (
                        <p className="text-xs uppercase tracking-wider text-cyan font-bold mb-1">
                          {addr.name}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{addr.street}</p>
                        {addr.isDefault && (
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Địa chỉ chính
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {addr.ward}, {addr.district} - {addr.province}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingId(addr.id);
                          setShowForm(false);
                        }}
                        title="Sửa"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (addr.isDefault) {
                            alert(
                              "Vui lòng chọn một địa chỉ khác làm địa chỉ chính trước khi xóa địa chỉ này.",
                            );
                            return;
                          }
                          deleteMutation.mutate(addr.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!addr.isDefault && (
                    <button
                      className="mt-3 flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      onClick={() => setDefaultMutation.mutate(addr.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <Star className="h-3.5 w-3.5" />
                      Đặt làm địa chỉ chính
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
