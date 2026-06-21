import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

/**
 * Cache Service for optimizing database queries
 * Uses in-memory caching with node-cache for single-server deployment
 * 
 * For production multi-server deployments, consider replacing with Redis
 */
class CacheService {
  private cache: NodeCache;
  private enabled: boolean;

  constructor() {
    // Initialize cache with default TTL of 5 minutes and check period of 60 seconds
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone objects for better performance
      deleteOnExpire: true
    });

    // Enable caching by default, can be disabled via environment variable
    this.enabled = process.env['CACHE_ENABLED'] !== 'false';

    if (this.enabled) {
      logger.info('Cache service initialized', {
        defaultTTL: 300,
        checkPeriod: 60
      });
    } else {
      logger.warn('Cache service is disabled');
    }

    // Log cache statistics periodically
    this.setupStatsLogging();
  }

  /**
   * Get a value from cache
   */
  public get<T>(key: string): T | undefined {
    if (!this.enabled) return undefined;

    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        logger.debug('Cache hit', { key });
      } else {
        logger.debug('Cache miss', { key });
      }
      return value;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return undefined;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (!this.enabled) return false;

    try {
      const success = this.cache.set(key, value, ttl || 0);
      if (success) {
        logger.debug('Cache set', { key, ttl: ttl || 'default' });
      }
      return success;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * Delete a specific key from cache
   */
  public del(key: string | string[]): number {
    if (!this.enabled) return 0;

    try {
      const deleted = this.cache.del(key);
      logger.debug('Cache delete', { key, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return 0;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  public delPattern(pattern: string): number {
    if (!this.enabled) return 0;

    try {
      const keys = this.cache.keys();
      const regex = new RegExp(pattern);
      const matchingKeys = keys.filter(key => regex.test(key));
      
      if (matchingKeys.length > 0) {
        const deleted = this.cache.del(matchingKeys);
        logger.debug('Cache delete pattern', { pattern, deleted });
        return deleted;
      }
      return 0;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    if (!this.enabled) return;

    try {
      this.cache.flushAll();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  /**
   * Check if a key exists in cache
   */
  public has(key: string): boolean {
    if (!this.enabled) return false;
    return this.cache.has(key);
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      enabled: this.enabled,
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      ksize: this.cache.getStats().ksize,
      vsize: this.cache.getStats().vsize
    };
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  public async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // If not in cache, fetch and store
    try {
      const value = await fetchFn();
      this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error });
      throw error;
    }
  }

  /**
   * Setup periodic stats logging
   */
  private setupStatsLogging(): void {
    if (!this.enabled) return;

    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      logger.info('Cache statistics', stats);
    }, 5 * 60 * 1000);
  }

  // ==================== DOMAIN-SPECIFIC CACHE METHODS ====================

  /**
   * Cache keys for different resources
   */
  private readonly CACHE_KEYS = {
    FEATURED_PRODUCTS: (limit: number) => `products:featured:${limit}`,
    PRODUCT_BY_SLUG: (slug: string) => `product:slug:${slug}`,
    PRODUCT_BY_ID: (id: string) => `product:id:${id}`,
    PRODUCTS_LIST: (filters: string) => `products:list:${filters}`,
    PRODUCT_CATEGORIES: 'products:categories',
    PRODUCT_STATS: 'products:stats',
    
    FEATURED_GALLERY: (limit: number) => `gallery:featured:${limit}`,
    GALLERY_BY_ID: (id: string) => `gallery:id:${id}`,
    GALLERY_LIST: (filters: string) => `gallery:list:${filters}`,
    GALLERY_CATEGORIES: 'gallery:categories',
    GALLERY_TAGS: 'gallery:tags',
    GALLERY_STATS: 'gallery:stats',
    
    HOME_CONTENT: 'home:content',
    HOME_STATS: 'home:stats'
  };

  /**
   * TTL values for different resource types (in seconds)
   */
  private readonly TTL = {
    FEATURED: 5 * 60,        // 5 minutes
    DETAIL: 10 * 60,         // 10 minutes
    LIST: 3 * 60,            // 3 minutes
    CATEGORIES: 60 * 60,     // 1 hour
    STATS: 5 * 60,           // 5 minutes
    HOME: 10 * 60            // 10 minutes
  };

  // Product cache methods
  public getFeaturedProducts(limit: number) {
    return this.get(this.CACHE_KEYS.FEATURED_PRODUCTS(limit));
  }

  public setFeaturedProducts(limit: number, data: any) {
    return this.set(this.CACHE_KEYS.FEATURED_PRODUCTS(limit), data, this.TTL.FEATURED);
  }

  public getProductBySlug(slug: string) {
    return this.get(this.CACHE_KEYS.PRODUCT_BY_SLUG(slug));
  }

  public setProductBySlug(slug: string, data: any) {
    return this.set(this.CACHE_KEYS.PRODUCT_BY_SLUG(slug), data, this.TTL.DETAIL);
  }

  public getProductById(id: string) {
    return this.get(this.CACHE_KEYS.PRODUCT_BY_ID(id));
  }

  public setProductById(id: string, data: any) {
    return this.set(this.CACHE_KEYS.PRODUCT_BY_ID(id), data, this.TTL.DETAIL);
  }

  public getProductsList(filters: string) {
    return this.get(this.CACHE_KEYS.PRODUCTS_LIST(filters));
  }

  public setProductsList(filters: string, data: any) {
    return this.set(this.CACHE_KEYS.PRODUCTS_LIST(filters), data, this.TTL.LIST);
  }

  public getProductCategories() {
    return this.get(this.CACHE_KEYS.PRODUCT_CATEGORIES);
  }

  public setProductCategories(data: any) {
    return this.set(this.CACHE_KEYS.PRODUCT_CATEGORIES, data, this.TTL.CATEGORIES);
  }

  public getProductStats() {
    return this.get(this.CACHE_KEYS.PRODUCT_STATS);
  }

  public setProductStats(data: any) {
    return this.set(this.CACHE_KEYS.PRODUCT_STATS, data, this.TTL.STATS);
  }

  /**
   * Invalidate all product caches
   */
  public invalidateProducts() {
    this.delPattern('^products:');
    this.delPattern('^product:');
    logger.info('Product caches invalidated');
  }

  /**
   * Invalidate specific product cache
   */
  public invalidateProduct(id: string, slug?: string) {
    this.del(this.CACHE_KEYS.PRODUCT_BY_ID(id));
    if (slug) {
      this.del(this.CACHE_KEYS.PRODUCT_BY_SLUG(slug));
    }
    // Also invalidate lists as they might contain this product
    this.delPattern('^products:list:');
    this.delPattern('^products:featured:');
    logger.info('Product cache invalidated', { id, slug });
  }

  // Gallery cache methods
  public getFeaturedGallery(limit: number) {
    return this.get(this.CACHE_KEYS.FEATURED_GALLERY(limit));
  }

  public setFeaturedGallery(limit: number, data: any) {
    return this.set(this.CACHE_KEYS.FEATURED_GALLERY(limit), data, this.TTL.FEATURED);
  }

  public getGalleryById(id: string) {
    return this.get(this.CACHE_KEYS.GALLERY_BY_ID(id));
  }

  public setGalleryById(id: string, data: any) {
    return this.set(this.CACHE_KEYS.GALLERY_BY_ID(id), data, this.TTL.DETAIL);
  }

  public getGalleryList(filters: string) {
    return this.get(this.CACHE_KEYS.GALLERY_LIST(filters));
  }

  public setGalleryList(filters: string, data: any) {
    return this.set(this.CACHE_KEYS.GALLERY_LIST(filters), data, this.TTL.LIST);
  }

  public getGalleryCategories() {
    return this.get(this.CACHE_KEYS.GALLERY_CATEGORIES);
  }

  public setGalleryCategories(data: any) {
    return this.set(this.CACHE_KEYS.GALLERY_CATEGORIES, data, this.TTL.CATEGORIES);
  }

  public getGalleryTags() {
    return this.get(this.CACHE_KEYS.GALLERY_TAGS);
  }

  public setGalleryTags(data: any) {
    return this.set(this.CACHE_KEYS.GALLERY_TAGS, data, this.TTL.CATEGORIES);
  }

  public getGalleryStats() {
    return this.get(this.CACHE_KEYS.GALLERY_STATS);
  }

  public setGalleryStats(data: any) {
    return this.set(this.CACHE_KEYS.GALLERY_STATS, data, this.TTL.STATS);
  }

  /**
   * Invalidate all gallery caches
   */
  public invalidateGallery() {
    this.delPattern('^gallery:');
    logger.info('Gallery caches invalidated');
  }

  /**
   * Invalidate specific gallery image cache
   */
  public invalidateGalleryImage(id: string) {
    this.del(this.CACHE_KEYS.GALLERY_BY_ID(id));
    // Also invalidate lists as they might contain this image
    this.delPattern('^gallery:list:');
    this.delPattern('^gallery:featured:');
    logger.info('Gallery image cache invalidated', { id });
  }

  // Home content cache methods
  public getHomeContent() {
    return this.get(this.CACHE_KEYS.HOME_CONTENT);
  }

  public setHomeContent(data: any) {
    return this.set(this.CACHE_KEYS.HOME_CONTENT, data, this.TTL.HOME);
  }

  public getHomeStats() {
    return this.get(this.CACHE_KEYS.HOME_STATS);
  }

  public setHomeStats(data: any) {
    return this.set(this.CACHE_KEYS.HOME_STATS, data, this.TTL.STATS);
  }

  /**
   * Invalidate home content caches
   */
  public invalidateHome() {
    this.delPattern('^home:');
    logger.info('Home content caches invalidated');
  }
}

// Export singleton instance
export const cacheService = new CacheService();
