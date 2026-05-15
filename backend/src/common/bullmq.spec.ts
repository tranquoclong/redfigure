import { withBullMqPrefix, getBullMqPrefix } from './bullmq';

describe('BullMQ prefix helper', () => {
  const ORIGINAL_ENV = process.env.BULLMQ_PREFIX;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.BULLMQ_PREFIX;
    else process.env.BULLMQ_PREFIX = ORIGINAL_ENV;
  });

  describe('getBullMqPrefix', () => {
    it('returns undefined when env not set (backward compat prod)', () => {
      delete process.env.BULLMQ_PREFIX;
      expect(getBullMqPrefix()).toBeUndefined();
    });

    it('returns undefined when env empty', () => {
      process.env.BULLMQ_PREFIX = '';
      expect(getBullMqPrefix()).toBeUndefined();
    });

    it('returns undefined when env only whitespace', () => {
      process.env.BULLMQ_PREFIX = '   ';
      expect(getBullMqPrefix()).toBeUndefined();
    });

    it('returns trimmed prefix when set', () => {
      process.env.BULLMQ_PREFIX = '  stg  ';
      expect(getBullMqPrefix()).toBe('stg');
    });
  });

  describe('withBullMqPrefix', () => {
    it('does NOT add prefix when env not set (preserves original opts)', () => {
      delete process.env.BULLMQ_PREFIX;
      const opts = { connection: { host: 'r', port: 6379 }, concurrency: 5 };
      const result = withBullMqPrefix(opts);
      expect(result).toEqual(opts);
      expect((result as any).prefix).toBeUndefined();
    });

    it('adds prefix when BULLMQ_PREFIX is set', () => {
      process.env.BULLMQ_PREFIX = 'stg';
      const opts = { connection: { host: 'r', port: 6379 }, concurrency: 5 };
      const result = withBullMqPrefix(opts);
      expect(result).toEqual({
        ...opts,
        prefix: 'stg',
      });
    });

    it('preserves existing properties (defaultJobOptions, etc)', () => {
      process.env.BULLMQ_PREFIX = 'stg';
      const opts = {
        connection: {},
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential' } },
        concurrency: 10,
      };
      const result = withBullMqPrefix(opts);
      expect(result).toMatchObject({
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential' } },
        concurrency: 10,
        prefix: 'stg',
      });
    });
  });
});
