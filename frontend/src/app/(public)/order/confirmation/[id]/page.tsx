import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { PurchaseTracker } from "./purchase-tracker";
import { ClaimAccountCta } from "./claim-account-cta";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <PurchaseTracker orderId={id} />
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
      <h1 className="text-3xl font-bold mb-2">Đơn hàng đã được xác nhận!</h1>
      <p className="text-muted-foreground mb-2">
        Đơn hàng của bạn đã được nhận thành công.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        ID đơn hàng: <span className="font-mono">{id}</span>
      </p>

      <ClaimAccountCta />

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={ROUTES.orders}>
          <Button>Xem đơn hàng của tôi</Button>
        </Link>
        <Link href={ROUTES.home}>
          <Button variant="outline">Tiếp tục mua sắm</Button>
        </Link>
      </div>
    </div>
  );
}
