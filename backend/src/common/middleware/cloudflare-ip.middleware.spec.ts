import { CloudflareIpMiddleware } from './cloudflare-ip.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('CloudflareIpMiddleware', () => {
  let middleware: CloudflareIpMiddleware;
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    middleware = new CloudflareIpMiddleware();
    (next as jest.Mock).mockClear();
  });

  function makeReq(
    headers: Record<string, string> = {},
    baseIp = '10.0.0.1',
  ): Request {
    const req = { headers } as unknown as Request;
    Object.defineProperty(req, 'ip', {
      value: baseIp,
      configurable: true,
      writable: true,
    });
    return req;
  }

  it('overrides req.ip with CF-Connecting-IP when present', () => {
    const req = makeReq({ 'cf-connecting-ip': '203.0.113.5' });
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('203.0.113.5');
    expect(next).toHaveBeenCalled();
  });

  it('trims whitespace from the header value', () => {
    const req = makeReq({ 'cf-connecting-ip': '  203.0.113.5  ' });
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('203.0.113.5');
  });

  it('leaves req.ip untouched when CF header missing', () => {
    const req = makeReq({}, '10.0.0.1');
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('10.0.0.1');
    expect(next).toHaveBeenCalled();
  });

  it('ignores empty CF header string', () => {
    const req = makeReq({ 'cf-connecting-ip': '' }, '10.0.0.1');
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('10.0.0.1');
  });

  it('ignores CF header absurdly long (>64 chars, likely bogus)', () => {
    const req = makeReq({ 'cf-connecting-ip': 'a'.repeat(200) }, '10.0.0.1');
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('10.0.0.1');
  });

  it('always calls next() — never blocks request', () => {
    const req = makeReq();
    middleware.use(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('handles IPv6 correctly', () => {
    const req = makeReq({
      'cf-connecting-ip': '2001:db8::1',
    });
    middleware.use(req, {} as Response, next);
    expect(req.ip).toBe('2001:db8::1');
  });
});
