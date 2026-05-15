import { createHmac } from 'crypto';

export interface LedgerHashInput {
  id: string;
  affiliateId: string;
  type: 'CREDIT' | 'DEBIT';
  source: 'COMMISSION' | 'PAYMENT' | 'MANUAL_CREDIT' | 'ADJUSTMENT' | string;
  amount: string;
  orderId: string | null;
  commissionId: string | null;
  paymentId: string | null;
  reason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export function canonicalizeLedgerRow(row: LedgerHashInput): string {
  const amount = normalizeAmount(row.amount);
  return JSON.stringify([
    'v2',
    row.id,
    row.affiliateId,
    row.type,
    row.source,
    amount,
    row.orderId,
    row.commissionId,
    row.paymentId,
    row.reason,
    row.createdByUserId,
    row.createdAt.toISOString(),
  ]);
}

function normalizeAmount(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid amount for hash: ${v}`);
  }
  return n.toFixed(2);
}

export function computeLedgerHash(
  row: LedgerHashInput,
  prevHash: string | null,
  secret: string,
): string {
  if (!secret) {
    throw new Error(
      'AFFILIATE_LEDGER_HMAC_SECRET is required - hash chain cannot operate without secret',
    );
  }
  const canonical = canonicalizeLedgerRow(row);
  const material = `${prevHash ?? ''}|${canonical}`;
  return createHmac('sha256', secret).update(material).digest('hex');
}
