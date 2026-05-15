import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  function createMockContext(): ExecutionContext {
    return {} as ExecutionContext;
  }

  it('should wrap response in { data } if not already wrapped', (done) => {
    const callHandler: CallHandler = {
      handle: () => of({ name: 'Test' }),
    };

    interceptor
      .intercept(createMockContext(), callHandler)
      .subscribe((result) => {
        expect(result).toEqual({ data: { name: 'Test' } });
        done();
      });
  });

  it('should NOT double-wrap if response already has { data }', (done) => {
    const callHandler: CallHandler = {
      handle: () => of({ data: { name: 'Test' } }),
    };

    interceptor
      .intercept(createMockContext(), callHandler)
      .subscribe((result) => {
        expect(result).toEqual({ data: { name: 'Test' } });
        done();
      });
  });

  it('should NOT wrap if response has { data } and { meta } (paginated)', (done) => {
    const paginated = {
      data: [{ id: 1 }],
      meta: { total: 1, page: 1, perPage: 10, lastPage: 1 },
    };
    const callHandler: CallHandler = {
      handle: () => of(paginated),
    };

    interceptor
      .intercept(createMockContext(), callHandler)
      .subscribe((result) => {
        expect(result).toEqual(paginated);
        done();
      });
  });

  it('should NOT wrap if response has { error }', (done) => {
    const errorResponse = { error: { statusCode: 400, message: 'Bad' } };
    const callHandler: CallHandler = {
      handle: () => of(errorResponse),
    };

    interceptor
      .intercept(createMockContext(), callHandler)
      .subscribe((result) => {
        expect(result).toEqual(errorResponse);
        done();
      });
  });

  it('should wrap primitive values', (done) => {
    const callHandler: CallHandler = {
      handle: () => of('hello'),
    };

    interceptor
      .intercept(createMockContext(), callHandler)
      .subscribe((result) => {
        expect(result).toEqual({ data: 'hello' });
        done();
      });
  });
});
