import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard';

describe('OwnershipGuard', () => {
  let guard: OwnershipGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new OwnershipGuard(reflector);
  });

  function createMockContext(
    user: { id: string; role: string },
    params: Record<string, string> = {},
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('should allow ADMIN to access any resource', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('userId');
    const context = createMockContext(
      { id: 'admin1', role: 'ADMIN' },
      { userId: 'other_user' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user to access their own resource', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('userId');
    const context = createMockContext(
      { id: 'user1', role: 'CUSTOMER' },
      { userId: 'user1' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny user from accessing another users resource', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('userId');
    const context = createMockContext(
      { id: 'user1', role: 'CUSTOMER' },
      { userId: 'user2' },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should skip check when no ownership key is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ id: 'user1', role: 'CUSTOMER' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
