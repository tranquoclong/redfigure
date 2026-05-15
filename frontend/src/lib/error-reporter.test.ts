import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  reportError,
  setSink,
  clearSink,
  getBufferedEvents,
  isReportableHttpStatus,
  __resetForTest,
} from './error-reporter';

describe('isReportableHttpStatus — filters 503 transient (Sentry signal/noise)', () => {
  it('reports 500/501/502/504 (real bugs or persistent upstream issues)', () => {
    expect(isReportableHttpStatus(500)).toBe(true);
    expect(isReportableHttpStatus(501)).toBe(true);
    expect(isReportableHttpStatus(502)).toBe(true);
    expect(isReportableHttpStatus(504)).toBe(true);
  });

  it('DOES NOT report 503 (Service Unavailable — by design infra/deploy/maintenance)', () => {

    expect(isReportableHttpStatus(503)).toBe(false);
  });

  it('DOES NOT report < 500 (4xx is client error, out of reporter scope)', () => {
    expect(isReportableHttpStatus(400)).toBe(false);
    expect(isReportableHttpStatus(401)).toBe(false);
    expect(isReportableHttpStatus(404)).toBe(false);
    expect(isReportableHttpStatus(429)).toBe(false);
  });

  it('DOES NOT report non-numeric status / out of range', () => {
    expect(isReportableHttpStatus(undefined as unknown as number)).toBe(false);
    expect(isReportableHttpStatus(NaN)).toBe(false);
    expect(isReportableHttpStatus(0)).toBe(false);
    expect(isReportableHttpStatus(600)).toBe(false);
  });
});

describe('error-reporter', () => {
  beforeEach(() => {
    __resetForTest();
  });

  it('reportError adds to buffer', () => {
    reportError({
      type: 'http',
      message: 'fail',
      status: 500,
      timestamp: Date.now(),
    });
    expect(getBufferedEvents()).toHaveLength(1);
    expect(getBufferedEvents()[0].status).toBe(500);
  });

  it('cap at MAX_BUFFER (50) — discards older events', () => {
    for (let i = 0; i < 60; i++) {
      reportError({
        type: 'http',
        message: `e${i}`,
        timestamp: Date.now(),
      });
    }
    const buf = getBufferedEvents();
    expect(buf).toHaveLength(50);

    expect(buf[0].message).toBe('e10');
    expect(buf[buf.length - 1].message).toBe('e59');
  });

  it('setSink drains pending buffer + routes new events', () => {
    reportError({
      type: 'http',
      message: 'pre1',
      timestamp: Date.now(),
    });
    reportError({
      type: 'http',
      message: 'pre2',
      timestamp: Date.now(),
    });

    const sink = vi.fn();
    setSink(sink);

    expect(sink).toHaveBeenCalledTimes(2);

    reportError({
      type: 'http',
      message: 'post',
      timestamp: Date.now(),
    });
    expect(sink).toHaveBeenCalledTimes(3);
    expect(sink.mock.calls[2][0].message).toBe('post');
  });

  it('setSink is idempotent — replaces sink without error', () => {
    const sink1 = vi.fn();
    const sink2 = vi.fn();
    setSink(sink1);
    setSink(sink2);

    reportError({
      type: 'http',
      message: 'x',
      timestamp: Date.now(),
    });
    expect(sink1).not.toHaveBeenCalled();
    expect(sink2).toHaveBeenCalledTimes(1);
  });

  it('clearSink returns to default (no-op in prod)', () => {
    const sink = vi.fn();
    setSink(sink);
    clearSink();

    reportError({
      type: 'http',
      message: 'x',
      timestamp: Date.now(),
    });
    expect(sink).not.toHaveBeenCalled();
  });

  it('sink that throws DOES NOT propagate — UX preserved', () => {
    const badSink = vi.fn().mockImplementation(() => {
      throw new Error('sink crashed');
    });
    setSink(badSink);

    expect(() =>
      reportError({
        type: 'http',
        message: 'x',
        timestamp: Date.now(),
      }),
    ).not.toThrow();
  });
});
