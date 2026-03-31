import { LRUCache } from "lru-cache";

export const overpassCache = new LRUCache<string, unknown>({
  max: 200,
  ttl: 1000 * 60 * 30,
});

