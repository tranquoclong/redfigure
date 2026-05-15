import {
  handleSlowQuery,
  SLOW_QUERY_WARN_MS,
  SLOW_QUERY_ERROR_MS,
} from './slow-query';

describe('handleSlowQuery', () => {
  let logger: { warn: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let breadcrumb: jest.Mock;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    breadcrumb = jest.fn();
  });

  function makeEvent(duration: number, query = 'SELECT 1') {
    return {
      timestamp: new Date(),
      query,
      params: '["SECRET_PARAM_DO_NOT_LOG"]',
      duration,
      target: 'public.users',
    };
  }

  it('DOES NOT log fast query (< warn threshold)', () => {
    handleSlowQuery(makeEvent(SLOW_QUERY_WARN_MS - 1), logger, breadcrumb);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('warn on query >= 300ms and < 1s', () => {
    handleSlowQuery(makeEvent(450), logger, breadcrumb);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    const arg = logger.warn.mock.calls[0][0];
    expect(arg.duration_ms).toBe(450);
  });

  it('error on query >= 1s', () => {
    handleSlowQuery(makeEvent(1500), logger, breadcrumb);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('exact boundary at SLOW_QUERY_WARN_MS triggers warn', () => {
    handleSlowQuery(makeEvent(SLOW_QUERY_WARN_MS), logger, breadcrumb);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('exact boundary at SLOW_QUERY_ERROR_MS triggers error', () => {
    handleSlowQuery(makeEvent(SLOW_QUERY_ERROR_MS), logger, breadcrumb);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('NEVER logs Prisma `params` (may contain PII)', () => {
    handleSlowQuery(
      makeEvent(500, 'SELECT * FROM users WHERE cccd = $1'),
      logger,
      breadcrumb,
    );
    const arg = logger.warn.mock.calls[0][0];
    expect(JSON.stringify(arg)).not.toContain('SECRET_PARAM_DO_NOT_LOG');

    expect(arg.query).toContain('SELECT * FROM users');
  });

  it('breadcrumb adds context for Sentry on slow queries', () => {
    handleSlowQuery(makeEvent(700), logger, breadcrumb);
    expect(breadcrumb).toHaveBeenCalledTimes(1);
    const bc = breadcrumb.mock.calls[0][0];
    expect(bc.category).toBe('prisma.slow_query');
    expect(bc.level).toBe('warning');
    expect(bc.data?.duration_ms).toBe(700);
  });

  it('breadcrumb with level error on very slow queries', () => {
    handleSlowQuery(makeEvent(2000), logger, breadcrumb);
    const bc = breadcrumb.mock.calls[0][0];
    expect(bc.level).toBe('error');
  });

  it('missing breadcrumb function does not break (Sentry no-op)', () => {
    expect(() =>
      handleSlowQuery(makeEvent(500), logger, undefined),
    ).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});
