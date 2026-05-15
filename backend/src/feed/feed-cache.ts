
export interface FeedCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export const FEED_CACHE = 'FEED_CACHE';
