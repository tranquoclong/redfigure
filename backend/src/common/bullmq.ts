import IORedis from 'ioredis';

let _sharedConn: IORedis | null = null;

export function getSharedBullMqConnection(): IORedis {
  if (_sharedConn) return _sharedConn;

  _sharedConn = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000)),
  });

  _sharedConn.on('error', (err) =>
    console.error('[BullMQ shared connection]', err.message),
  );

  return _sharedConn;
}

export function getBullMqPrefix(): string | undefined {
  const raw = process.env.BULLMQ_PREFIX?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function withBullMqPrefix<T extends Record<string, unknown>>(opts: T): T & { sharedConnection: boolean } {
  const prefix = getBullMqPrefix();
  const enhanced = { ...opts, sharedConnection: true };
  if (!prefix) return enhanced as T & { sharedConnection: boolean };
  return { ...enhanced, prefix } as T & { sharedConnection: boolean };
}