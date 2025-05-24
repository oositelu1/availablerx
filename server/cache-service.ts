// In-memory cache service with TTL support
// Can be replaced with Redis for production scaling

interface CacheEntry<T> {
  data: T;
  expires: number;
  hits: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  
  constructor(maxSize = 1000, defaultTTLMinutes = 60) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMinutes * 60 * 1000;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Get or fetch data with caching
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMinutes?: number
  ): Promise<T> {
    // Check if we have a valid cached entry
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch new data
    const data = await fetcher();
    
    // Cache the result
    this.set(key, data, ttlMinutes);
    
    return data;
  }
  
  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hits++;
    
    return entry.data as T;
  }
  
  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttlMinutes?: number): void {
    // Enforce size limit using LRU eviction
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      hits: 0
    });
  }
  
  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: entries.map(([key, entry]) => ({
        key,
        hits: entry.hits,
        ttl: Math.max(0, entry.expires - now),
        size: JSON.stringify(entry.data).length
      })).sort((a, b) => b.hits - a.hits)
    };
  }
  
  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`Cache cleanup: removed ${removed} expired entries`);
    }
  }
  
  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let minHits = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}

// Singleton instance
export const cache = new CacheService();

// Cache key generators
export const cacheKeys = {
  product: (gtin: string) => `product:${gtin}`,
  partner: (id: number) => `partner:${id}`,
  file: (id: number) => `file:${id}`,
  fileValidation: (sha256: string) => `validation:${sha256}`,
  purchaseOrder: (id: number) => `po:${id}`,
  inventory: (gtin: string, serial: string) => `inv:${gtin}:${serial}`,
  userPermissions: (userId: number) => `perms:${userId}`
};

// Common TTL values (in minutes)
export const cacheTTL = {
  short: 5,      // 5 minutes for frequently changing data
  medium: 60,    // 1 hour for semi-static data
  long: 240,     // 4 hours for static data
  day: 1440      // 24 hours for very static data
};