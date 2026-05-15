import { describe, it, expect } from 'vitest';
import {
  ORDER_STEPS,
  getOrderStepIndex,
  getOrderStatusInfo,
  isOrderInProgress,
} from './order-status';

describe('order-status helpers', () => {
  describe('ORDER_STEPS', () => {
    it('exposes 5 steps in the production funnel order', () => {
      expect(ORDER_STEPS).toEqual([
        { key: 'PENDING', label: 'Pending' },
        { key: 'CONFIRMED', label: 'Confirmed' },
        { key: 'PROCESSING', label: 'In production' },
        { key: 'SHIPPED', label: 'Shipped' },
        { key: 'DELIVERED', label: 'Delivered' },
      ]);
    });
  });

  describe('getOrderStepIndex', () => {
    it.each([
      ['PENDING', 0],
      ['CONFIRMED', 1],
      ['PROCESSING', 2],
      ['SHIPPED', 3],
      ['DELIVERED', 4],
    ])('returns index %s → %i', (status, expected) => {
      expect(getOrderStepIndex(status)).toBe(expected);
    });

    it('returns -1 for terminal-failure states (CANCELLED/RETURNED)', () => {
      expect(getOrderStepIndex('CANCELLED')).toBe(-1);
      expect(getOrderStepIndex('RETURNED')).toBe(-1);
    });

    it('returns -1 for unknown status', () => {
      expect(getOrderStepIndex('SOMETHING_NEW')).toBe(-1);
    });
  });

  describe('getOrderStatusInfo', () => {
    it('returns label + tone="ok" for happy path states', () => {
      const info = getOrderStatusInfo('PROCESSING');
      expect(info.label).toBe('In production');
      expect(info.tone).toBe('ok');
    });

    it('returns tone="danger" for CANCELLED', () => {
      const info = getOrderStatusInfo('CANCELLED');
      expect(info.label).toBe('Cancelled');
      expect(info.tone).toBe('danger');
    });

    it('returns tone="warn" for RETURNED', () => {
      const info = getOrderStatusInfo('RETURNED');
      expect(info.label).toBe('Returned');
      expect(info.tone).toBe('warn');
    });

    it('returns tone="ok" for DELIVERED (final happy state)', () => {
      const info = getOrderStatusInfo('DELIVERED');
      expect(info.tone).toBe('ok');
    });

    it('returns label fallback for unknown status', () => {
      const info = getOrderStatusInfo('FOO');
      expect(info.label).toBe('FOO');
      expect(info.tone).toBe('ok');
    });
  });

  describe('isOrderInProgress', () => {
    it('returns true for PENDING/CONFIRMED/PROCESSING/SHIPPED', () => {
      expect(isOrderInProgress('PENDING')).toBe(true);
      expect(isOrderInProgress('CONFIRMED')).toBe(true);
      expect(isOrderInProgress('PROCESSING')).toBe(true);
      expect(isOrderInProgress('SHIPPED')).toBe(true);
    });

    it('returns false for DELIVERED (completed), CANCELLED, RETURNED', () => {
      expect(isOrderInProgress('DELIVERED')).toBe(false);
      expect(isOrderInProgress('CANCELLED')).toBe(false);
      expect(isOrderInProgress('RETURNED')).toBe(false);
    });
  });
});
