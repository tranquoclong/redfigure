import { JwtService } from '@nestjs/jwt';
import { BullBoardAdminAuthMiddleware } from './bull-board-admin-auth.middleware';

describe('BullBoardAdminAuthMiddleware', () => {
  let middleware: BullBoardAdminAuthMiddleware;
  let jwtService: { verifyAsync: jest.Mock };

  function makeReq(
    headers: Record<string, string> = {},
    cookies: Record<string, string> = {},
  ) {
    return { headers, cookies } as never;
  }
  function makeRes() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    return res as never;
  }

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    middleware = new BullBoardAdminAuthMiddleware(
      jwtService as unknown as JwtService,
    );
  });

  it('responds 401 when there is no Authorization header nor cookie', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when JWT is invalid', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
    const req = makeReq({ authorization: 'Bearer bad-token' });
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when JWT is refresh type (only access is valid)', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u1',
      role: 'ADMIN',
      type: 'refresh',
    });
    const req = makeReq({ authorization: 'Bearer refresh-token' });
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when role is not ADMIN', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'u1',
      role: 'CUSTOMER',
      type: 'access',
    });
    const req = makeReq({ authorization: 'Bearer customer-token' });
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when valid access JWT + ADMIN role', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'admin1',
      role: 'ADMIN',
      type: 'access',
    });
    const req = makeReq({ authorization: 'Bearer admin-token' });
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
