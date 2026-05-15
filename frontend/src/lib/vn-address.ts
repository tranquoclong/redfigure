export interface VnProvince {
  code: number;
  name: string;
}
export interface VnDistrict {
  code: number;
  name: string;
}
export interface VnWard {
  code: number;
  name: string;
}

const VN_API = "https://provinces.open-api.vn/api";

export async function vnFetchProvinces(): Promise<VnProvince[]> {
  const res = await fetch(`${VN_API}/?depth=1`);
  if (!res.ok) throw new Error("fetch provinces failed");
  return res.json();
}

export async function vnFetchDistricts(
  provinceCode: number,
): Promise<VnDistrict[]> {
  const res = await fetch(`${VN_API}/p/${provinceCode}?depth=2`);
  if (!res.ok) throw new Error("fetch districts failed");
  const d = await res.json();
  return d.districts ?? [];
}

export async function vnFetchWards(districtCode: number): Promise<VnWard[]> {
  const res = await fetch(`${VN_API}/d/${districtCode}?depth=2`);
  if (!res.ok) throw new Error("fetch wards failed");
  const d = await res.json();
  return d.wards ?? [];
}
