"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  reservedStock: number;
  available: number;
  threshold: number;
  category?: string;
}

interface LowStockVariation {
  id: string;
  productId: string;
  productName: string;
  variationName: string;
  stock: number;
  reservedStock: number;
  available: number;
  threshold: number;
}

export default function StockAdminPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { data } = await api.get("/stock/low-stock");
      return data.data as {
        products: LowStockProduct[];
        variations: LowStockVariation[];
        total: number;
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý tồn kho</h1>
        <Badge variant="outline" className="text-sm">
          {data?.total ?? 0} sản phẩm có tồn kho thấp
        </Badge>
      </div>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {data && data.total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Tất cả các sản phẩm đều có tồn kho tốt.
            </p>
          </CardContent>
        </Card>
      )}

      {data && data.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sản phẩm thông thường
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Sản phẩm</th>
                    <th className="text-left p-3 font-medium">Danh mục</th>
                    <th className="text-right p-3 font-medium">Tồn kho</th>
                    <th className="text-right p-3 font-medium">Đã đặt</th>
                    <th className="text-right p-3 font-medium">Có sẵn</th>
                    <th className="text-right p-3 font-medium">Ngưỡng</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {p.category ?? "-"}
                      </td>
                      <td className="p-3 text-right font-mono">{p.stock}</td>
                      <td className="p-3 text-right font-mono text-amber-600">
                        {p.reservedStock}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={
                            p.available <= 0
                              ? "text-red-600 font-bold"
                              : p.available <= p.threshold
                                ? "text-amber-600"
                                : ""
                          }
                        >
                          {p.available}
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {p.threshold}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          Sửa <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.variations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Các loại
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Sản phẩm</th>
                    <th className="text-left p-3 font-medium">Loại</th>
                    <th className="text-right p-3 font-medium">Tồn kho</th>
                    <th className="text-right p-3 font-medium">Đã đặt</th>
                    <th className="text-right p-3 font-medium">Có sẵn</th>
                    <th className="text-right p-3 font-medium">Ngưỡng</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.variations.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="p-3 font-medium">{v.productName}</td>
                      <td className="p-3 text-muted-foreground">
                        {v.variationName}
                      </td>
                      <td className="p-3 text-right font-mono">{v.stock}</td>
                      <td className="p-3 text-right font-mono text-amber-600">
                        {v.reservedStock}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={
                            v.available <= 0
                              ? "text-red-600 font-bold"
                              : v.available <= v.threshold
                                ? "text-amber-600"
                                : ""
                          }
                        >
                          {v.available}
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {v.threshold}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/admin/products/${v.productId}`}
                          className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          Sửa <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
