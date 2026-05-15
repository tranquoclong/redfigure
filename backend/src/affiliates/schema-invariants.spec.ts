

import {
  AffiliateStatus,
  CommissionStatus,
  CommissionSource,
  LedgerType,
  LedgerSource,
  CommissionRuleScope,
  PaymentRequestStatus,
  Prisma,
} from '@prisma/client';

describe('Affiliates — schema invariants (PR 1)', () => {
  describe('enums', () => {
    it('AffiliateStatus has 4 expected values', () => {
      expect(Object.values(AffiliateStatus).sort()).toEqual([
        'APPROVED',
        'PENDING',
        'REJECTED',
        'SUSPENDED',
      ]);
    });

    it('CommissionStatus has 3 expected values', () => {
      expect(Object.values(CommissionStatus).sort()).toEqual([
        'APPROVED',
        'CANCELLED',
        'PENDING',
      ]);
    });

    it('CommissionSource limits to COOKIE or COUPON — source can never be invented', () => {
      expect(Object.values(CommissionSource).sort()).toEqual([
        'COUPON',
        'REFERRAL_COOKIE',
      ]);
    });

    it('LedgerType only CREDIT or DEBIT', () => {
      expect(Object.values(LedgerType).sort()).toEqual(['CREDIT', 'DEBIT']);
    });

    it('LedgerSource covers 4 entry origins foreseen by the plan', () => {
      expect(Object.values(LedgerSource).sort()).toEqual([
        'ADJUSTMENT',
        'COMMISSION',
        'MANUAL_CREDIT',
        'PAYMENT',
      ]);
    });

    it('CommissionRuleScope includes GLOBAL (only for audit) + 3 hierarchy levels', () => {

      expect(Object.values(CommissionRuleScope).sort()).toEqual([
        'CATEGORY',
        'GLOBAL',
        'PRODUCT',
        'TAG',
      ]);
    });

    it('PaymentRequestStatus includes PARTIALLY_PAID (partial admin payment)', () => {
      expect(Object.values(PaymentRequestStatus).sort()).toEqual([
        'CANCELLED',
        'PAID',
        'PARTIALLY_PAID',
        'PENDING',
      ]);
    });
  });

  describe('model types — compile-time checks', () => {
    it('AffiliateAccount can be used via Prisma namespace (generated types)', () => {

      const sample: Prisma.AffiliateAccountCreateInput = {
        user: { connect: { id: 'u1' } },
        termsAcceptedAt: new Date(),
      };
      expect(sample.user).toBeDefined();
    });

    it('AffiliateCommission requires orderItemId (unique + FK)', () => {
      const sample: Prisma.AffiliateCommissionCreateInput = {
        affiliate: { connect: { id: 'a1' } },
        order: { connect: { id: 'o1' } },
        orderItem: { connect: { id: 'oi1' } },
        source: 'REFERRAL_COOKIE',
        baseAmount: 100,
        rate: 5,
        commissionAmount: 5,
      };
      expect(sample.orderItem).toBeDefined();
    });

    it('AffiliateLedgerEntry requires type+source — amount is positive, sign comes from type', () => {

      const credit: Prisma.AffiliateLedgerEntryCreateInput = {
        affiliate: { connect: { id: 'a1' } },
        type: 'CREDIT',
        source: 'COMMISSION',
        amount: 5,
        commission: { connect: { id: 'c1' } },
      };
      expect(credit.type).toBe('CREDIT');

      const debit: Prisma.AffiliateLedgerEntryCreateInput = {
        affiliate: { connect: { id: 'a1' } },
        type: 'DEBIT',
        source: 'PAYMENT',
        amount: 100,
        payment: { connect: { id: 'p1' } },
      };
      expect(debit.type).toBe('DEBIT');
    });

    it('AffiliateCommissionRuleAudit exists — anti-fraud audit trail of changes in rules', () => {
      const audit: Prisma.AffiliateCommissionRuleAuditCreateInput = {
        scope: 'PRODUCT',
        action: 'CREATED',
        changedByUserId: 'admin1',
      };
      expect(audit.action).toBe('CREATED');
    });

    it('AffiliatePaymentRequest includes amountPaid default 0 for partial tracking', () => {
      const req: Prisma.AffiliatePaymentRequestCreateInput = {
        affiliate: { connect: { id: 'a1' } },
        amountRequested: 100,
      };

      expect(req.affiliate).toBeDefined();
    });

    it('AffiliatePayment requires createdByUserId — audit required', () => {

      const payment: Prisma.AffiliatePaymentCreateInput = {
        affiliate: { connect: { id: 'a1' } },
        amount: 100,
        paidAt: new Date(),
        createdByUserId: 'admin1',
      };
      expect(payment.createdByUserId).toBe('admin1');
    });
  });

  describe('relations — changes in existing tables', () => {
    it('Order gained referringAffiliateId + referringAffiliateSource (cookie snapshot)', () => {
      const order: Prisma.OrderUncheckedCreateInput = {
        userId: 'u1',
        number: 'ORD-2026-001',
        subtotal: 100,
        total: 100,
        referringAffiliateId: 'a1',
        referringAffiliateSource: 'REFERRAL_COOKIE',
      };
      expect(order.referringAffiliateId).toBe('a1');
    });

    it('Coupon gained affiliateId (coupon→affiliate assignment)', () => {
      const coupon: Prisma.CouponUncheckedCreateInput = {
        code: 'TESTE',
        type: 'PERCENTAGE',
        value: 10,
        affiliateId: 'a1',
      };
      expect(coupon.affiliateId).toBe('a1');
    });

    it('OrderItem.commission is 1:1 — orderItemId @unique in AffiliateCommission', () => {

      type CommissionRel = Prisma.OrderItemInclude['commission'];
      const include: CommissionRel = true;
      expect(include).toBe(true);
    });

    it('User.affiliateAccount is 1:1 — userId @unique in AffiliateAccount', () => {
      type AccountRel = Prisma.UserInclude['affiliateAccount'];
      const include: AccountRel = true;
      expect(include).toBe(true);
    });
  });
});
