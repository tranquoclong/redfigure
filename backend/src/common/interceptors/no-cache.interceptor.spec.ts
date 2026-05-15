import { NoCacheInterceptor } from './no-cache.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('NoCacheInterceptor', () => {
  let interceptor: NoCacheInterceptor;

  const mockSetHeader = jest.fn();

  function createContext(url: string): ExecutionContext {
    return {
      switchToHttp: () => ({

        getRequest: () => ({ url, path: url.split('?')[0] }),
        getResponse: () => ({ setHeader: mockSetHeader }),
      }),
    } as unknown as ExecutionContext;
  }

  const mockNext: CallHandler = {
    handle: () => of({ data: 'test' }),
  };

  beforeEach(() => {
    interceptor = new NoCacheInterceptor();
    jest.clearAllMocks();
  });

  it('should set no-cache headers for /api/v1/cart', (done) => {
    const ctx = createContext('/api/v1/cart');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-store, no-cache, must-revalidate',
      );
      expect(mockSetHeader).toHaveBeenCalledWith(
        'CDN-Cache-Control',
        'no-store',
      );
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cloudflare-CDN-Cache-Control',
        'no-store',
      );
      done();
    });
  });

  it('should set no-cache headers for /api/v1/recently-viewed', (done) => {
    const ctx = createContext('/api/v1/recently-viewed');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('private'),
      );
      done();
    });
  });

  it('should set no-cache headers for /api/v1/orders subpaths', (done) => {
    const ctx = createContext('/api/v1/orders/some-id');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
      done();
    });
  });

  it('should set no-cache headers for /api/v1/wishlist', (done) => {
    const ctx = createContext('/api/v1/wishlist');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledTimes(3);
      done();
    });
  });

  it('should NOT set cache headers for public routes like /api/v1/products', (done) => {
    const ctx = createContext('/api/v1/products');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should NOT set cache headers for /api/v1/categories', (done) => {
    const ctx = createContext('/api/v1/categories');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should NOT set cache headers for /api/v1/blog', (done) => {
    const ctx = createContext('/api/v1/blog');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).not.toHaveBeenCalled();
      done();
    });
  });

  it('should set no-cache headers for /api/v1/site/home-blocks', (done) => {
    const ctx = createContext('/api/v1/site/home-blocks');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
      done();
    });
  });

  it('should set no-cache headers for /api/v1/site/topbar', (done) => {
    const ctx = createContext('/api/v1/site/topbar');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
      done();
    });
  });

  it('should set no-cache headers for /api/v1/admin/site/cache/flush', (done) => {
    const ctx = createContext('/api/v1/admin/site/cache/flush');

    interceptor.intercept(ctx, mockNext).subscribe(() => {
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
      done();
    });
  });
});
