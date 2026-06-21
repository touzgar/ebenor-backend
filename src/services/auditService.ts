import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

export interface CreateAuditLogParams {
  userId: string;
  userEmail?: string;
  action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'bulk_update' | 'login' | 'logout' | 'password_change' | 'upload' | 'download';
  resource: 'product' | 'gallery' | 'home' | 'message' | 'user' | 'media' | 'auth';
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

class AuditService {
  /**
   * Create a new audit log entry
   */
  async createAuditLog(params: CreateAuditLogParams): Promise<void> {
    try {
      const auditLog = new AuditLog({
        userId: params.userId,
        userEmail: params.userEmail,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        changes: params.changes,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        timestamp: new Date(),
        metadata: params.metadata
      });

      await auditLog.save();

      // Log destructive operations with higher priority
      if (['delete', 'bulk_delete'].includes(params.action)) {
        logger.warn('Destructive operation logged', {
          userId: params.userId,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId
        });
      }
    } catch (error) {
      // Don't throw errors for audit logging failures to avoid breaking main operations
      logger.error('Failed to create audit log', { error, params });
    }
  }

  /**
   * Get audit logs with filters and pagination
   */
  async getAuditLogs(
    filters: AuditLogFilters = {},
    pagination: PaginationOptions = {}
  ) {
    const { page = 1, limit = 50 } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.action) {
      query.action = filters.action;
    }

    if (filters.resource) {
      query.resource = filters.resource;
    }

    if (filters.resourceId) {
      query.resourceId = filters.resourceId;
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.timestamp.$lte = filters.endDate;
      }
    }

    // Execute query
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getAuditLogsByResource(
    resource: string,
    resourceId: string,
    limit = 50
  ) {
    const logs = await AuditLog.find({ resource, resourceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  }

  /**
   * Get audit logs for a specific user
   */
  async getAuditLogsByUser(userId: string, limit = 50) {
    const logs = await AuditLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  }

  /**
   * Get recent audit logs
   */
  async getRecentAuditLogs(limit = 50) {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string) {
    const log = await AuditLog.findById(id).lean();
    return log;
  }

  /**
   * Get destructive operations (deletes)
   */
  async getDestructiveOperations(limit = 50) {
    const logs = await AuditLog.find({
      action: { $in: ['delete', 'bulk_delete'] }
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate?: Date, endDate?: Date) {
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = startDate;
      if (endDate) matchStage.timestamp.$lte = endDate;
    }

    const stats = await AuditLog.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $facet: {
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byResource: [
            { $group: { _id: '$resource', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byUser: [
            { $group: { _id: '$userId', userEmail: { $first: '$userEmail' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          total: [
            { $count: 'count' }
          ]
        }
      }
    ]);

    return {
      byAction: stats[0].byAction,
      byResource: stats[0].byResource,
      byUser: stats[0].byUser,
      total: stats[0].total[0]?.count || 0
    };
  }

  /**
   * Clean up old audit logs (older than specified days)
   * Note: TTL index handles this automatically, but this method can be used for manual cleanup
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
    return result.deletedCount;
  }
}

export const auditService = new AuditService();
