

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export interface OrderStep {
  key: OrderStatus;
  label: string;
}

export const ORDER_STEPS: ReadonlyArray<OrderStep> = [
  { key: 'PENDING', label: 'Chờ xử lý' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PROCESSING', label: 'Đang sản xuất' },
  { key: 'SHIPPED', label: 'Đã giao hàng' },
  { key: 'DELIVERED', label: 'Đã nhận hàng' },
];

export function getOrderStepIndex(status: string): number {
  return ORDER_STEPS.findIndex((step) => step.key === status);
}

export interface OrderStatusInfo {
  label: string;
  tone: 'ok' | 'warn' | 'danger';
}

const STATUS_INFO: Record<OrderStatus, OrderStatusInfo> = {
  PENDING: { label: 'Chờ xử lý', tone: 'ok' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'ok' },
  PROCESSING: { label: 'Đang sản xuất', tone: 'ok' },
  SHIPPED: { label: 'Đã giao hàng', tone: 'ok' },
  DELIVERED: { label: 'Đã nhận hàng', tone: 'ok' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
  RETURNED: { label: 'Đã trả hàng', tone: 'warn' },
};

export function getOrderStatusInfo(status: string): OrderStatusInfo {
  return STATUS_INFO[status as OrderStatus] ?? { label: status, tone: 'ok' };
}

export function isOrderInProgress(status: string): boolean {
  return (
    status === 'PENDING' ||
    status === 'CONFIRMED' ||
    status === 'PROCESSING' ||
    status === 'SHIPPED'
  );
}
