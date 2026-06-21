import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { auditService } from '../services/auditService';
import { ApiError } from '../middleware/errorHandler';

/**
 * Get audit logs with filters and pagination
 */
export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    // Build filters
    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (action) filters.action = action as string;
    if (resource) filters.resource = resource as string;
    if (resourceId) filters.resourceId = resourceId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    // Get logs
    const result = await auditService.getAuditLogs(filters, {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log by ID
 */
export const getAuditLogById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const log = await auditService.getAuditLogById(id);

    if (!log) {
      throw new ApiError('Audit log not found', 404);
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs for a specific resource
 */
export const getAuditLogsByResource = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { resource, id } = req.params;
    const { limit = '50' } = req.query;

    const logs = await auditService.getAuditLogsByResource(
      resource,
      id,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs for a specific user
 */
export const getAuditLogsByUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { limit = '50' } = req.query;

    const logs = await auditService.getAuditLogsByUser(
      userId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent audit logs
 */
export const getRecentAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '50' } = req.query;

    const logs = await auditService.getRecentAuditLogs(
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get destructive operations (deletes)
 */
export const getDestructiveOperations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { limit = '50' } = req.query;

    const logs = await auditService.getDestructiveOperations(
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit statistics
 */
export const getAuditStatistics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await auditService.getAuditStatistics(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
