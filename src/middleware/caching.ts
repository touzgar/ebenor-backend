import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to set cache headers for API responses
 * 
 * Cache-Control directives:
 * - public: Response can be cached by any cache (browser, CDN, proxy)
 * - private: Response can only be cached by browser
 * - no-cache: Must revalidate with server before using cached version
 * - no-store: Must not be cached at all
 * - max-age: Time in seconds the response is considered fresh
 * - stale-while-revalidate: Time in seconds to serve stale content while revalidating
 */

interface CacheOptions {
  maxAge?: number; // in seconds
  sMaxAge?: number; // for shared caches (CDN)
  staleWhileRevalidate?: number; // in seconds
  staleIfError?: number; // in seconds
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  isPublic?: boolean;
  isPrivate?: boolean;
}

/**
 * Generate Cache-Control header value from options
 */
function generateCacheControl(options: CacheOptions): string {
  const directives: string[] = [];

  if (options.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (options.noCache) {
    directives.push('no-cache');
  }

  if (options.isPublic) {
    directives.push('public');
  } else if (options.isPrivate) {
    directives.push('private');
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Middleware to set cache headers for GET requests
 * 
 * @param options - Cache configuration options
 * @returns Express middleware function
 */
export function cacheControl(options: CacheOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method === 'GET') {
      const cacheControlValue = generateCacheControl(options);
      res.setHeader('Cache-Control', cacheControlValue);
    }
    next();
  };
}

/**
 * Predefined cache strategies for common use cases
 */
export const CacheStrategies = {
  /**
   * No caching - always fetch fresh data
   * Use for: Admin data, user-specific data, real-time data
   */
  noCache: () => cacheControl({
    noStore: true,
  }),

  /**
   * Short cache - 5 minutes
   * Use for: Frequently changing public data (product lists, gallery)
   */
  short: () => cacheControl({
    isPublic: true,
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 60, // 1 minute
  }),

  /**
   * Medium cache - 1 hour
   * Use for: Semi-static content (product details, homepage content)
   */
  medium: () => cacheControl({
    isPublic: true,
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 300, // 5 minutes
  }),

  /**
   * Long cache - 24 hours
   * Use for: Static content (categories, tags)
   */
  long: () => cacheControl({
    isPublic: true,
    maxAge: 86400, // 24 hours
    staleWhileRevalidate: 3600, // 1 hour
  }),

  /**
   * Private cache - 5 minutes, browser only
   * Use for: User-specific data that can be cached
   */
  private: () => cacheControl({
    isPrivate: true,
    maxAge: 300, // 5 minutes
    mustRevalidate: true,
  }),
};

/**
 * Middleware to add ETag support for conditional requests
 * This allows clients to use If-None-Match header to avoid re-downloading unchanged content
 */
export function etag() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data: any): Response {
      // Only add ETag for GET requests with 200 status
      if (req.method === 'GET' && res.statusCode === 200) {
        // Generate simple ETag from content
        const etag = `"${Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 27)}"`;
        res.setHeader('ETag', etag);

        // Check If-None-Match header
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          res.status(304).end();
          return res;
        }
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Middleware to add Vary header for content negotiation
 * This tells caches that the response varies based on certain request headers
 */
export function vary(...headers: string[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const varyHeader = headers.join(', ');
    res.setHeader('Vary', varyHeader);
    next();
  };
}
