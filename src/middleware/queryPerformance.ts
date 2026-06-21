import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Query Performance Monitoring Middleware
 * Logs slow queries and provides performance metrics
 */

// Threshold for slow queries in milliseconds
const SLOW_QUERY_THRESHOLD = parseInt(process.env['SLOW_QUERY_THRESHOLD'] || '100', 10);

// Enable/disable query performance monitoring
const MONITORING_ENABLED = process.env['QUERY_MONITORING_ENABLED'] !== 'false';

interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
}

class QueryPerformanceMonitor {
  private stats: QueryStats = {
    totalQueries: 0,
    slowQueries: 0,
    avgDuration: 0,
    maxDuration: 0,
    minDuration: Infinity
  };

  private durations: number[] = [];

  constructor() {
    if (MONITORING_ENABLED) {
      this.setupMongooseDebug();
      this.setupPeriodicReporting();
    }
  }

  /**
   * Setup Mongoose debug mode to log queries
   */
  private setupMongooseDebug(): void {
    mongoose.set('debug', (collectionName: string, method: string, query: any, doc: any) => {
      // This will be called for every query
      // We can use this to track query patterns
      logger.debug('MongoDB Query', {
        collection: collectionName,
        method,
        query: JSON.stringify(query)
      });
    });
  }

  /**
   * Setup periodic reporting of query statistics
   */
  private setupPeriodicReporting(): void {
    // Report stats every 5 minutes
    setInterval(() => {
      if (this.stats.totalQueries > 0) {
        logger.info('Query Performance Statistics', {
          ...this.stats,
          slowQueryThreshold: SLOW_QUERY_THRESHOLD
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Record query duration
   */
  public recordQuery(duration: number, details?: any): void {
    if (!MONITORING_ENABLED) return;

    this.stats.totalQueries++;
    this.durations.push(duration);

    // Update min/max
    if (duration > this.stats.maxDuration) {
      this.stats.maxDuration = duration;
    }
    if (duration < this.stats.minDuration) {
      this.stats.minDuration = duration;
    }

    // Calculate average
    this.stats.avgDuration = this.durations.reduce((a, b) => a + b, 0) / this.durations.length;

    // Check if slow query
    if (duration > SLOW_QUERY_THRESHOLD) {
      this.stats.slowQueries++;
      logger.warn('Slow Query Detected', {
        duration: `${duration}ms`,
        threshold: `${SLOW_QUERY_THRESHOLD}ms`,
        ...details
      });
    }

    // Keep only last 1000 durations to prevent memory leak
    if (this.durations.length > 1000) {
      this.durations = this.durations.slice(-1000);
    }
  }

  /**
   * Get current statistics
   */
  public getStats(): QueryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity
    };
    this.durations = [];
  }
}

// Singleton instance
export const queryMonitor = new QueryPerformanceMonitor();

/**
 * Express middleware to track request-level query performance
 */
export const queryPerformanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!MONITORING_ENABLED) {
    return next();
  }

  const startTime = Date.now();

  // Override res.json to capture when response is sent
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    // Record the query performance
    queryMonitor.recordQuery(duration, {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode
    });

    // Log slow requests
    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow Request', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        query: req.query,
        statusCode: res.statusCode
      });
    }

    return originalJson(body);
  };

  next();
};

/**
 * Helper function to measure async operation performance
 */
export async function measureQueryPerformance<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    queryMonitor.recordQuery(duration, {
      operation: operationName
    });

    if (duration > SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow Operation', {
        operation: operationName,
        duration: `${duration}ms`
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Operation Failed', {
      operation: operationName,
      duration: `${duration}ms`,
      error
    });
    throw error;
  }
}

/**
 * Endpoint to get query performance statistics (for admin dashboard)
 */
export const getQueryStats = (req: Request, res: Response) => {
  const stats = queryMonitor.getStats();
  
  res.json({
    success: true,
    data: {
      ...stats,
      slowQueryThreshold: SLOW_QUERY_THRESHOLD,
      monitoringEnabled: MONITORING_ENABLED,
      minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration
    }
  });
};

/**
 * Endpoint to reset query performance statistics
 */
export const resetQueryStats = (req: Request, res: Response) => {
  queryMonitor.resetStats();
  
  res.json({
    success: true,
    message: 'Query statistics reset successfully'
  });
};
