import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getAuditLogs,
  getAuditLogById,
  getAuditLogsByResource,
  getAuditLogsByUser,
  getRecentAuditLogs,
  getDestructiveOperations,
  getAuditStatistics
} from '../../controllers/auditController';

const router = Router();

// All audit routes require authentication and admin/super_admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

/**
 * @route   GET /api/admin/audit
 * @desc    Get audit logs with filters and pagination
 * @access  Admin, Super Admin
 * @query   userId, action, resource, resourceId, startDate, endDate, page, limit
 */
router.get('/', getAuditLogs);

/**
 * @route   GET /api/admin/audit/recent
 * @desc    Get recent audit logs
 * @access  Admin, Super Admin
 * @query   limit
 */
router.get('/recent', getRecentAuditLogs);

/**
 * @route   GET /api/admin/audit/destructive
 * @desc    Get destructive operations (deletes)
 * @access  Admin, Super Admin
 * @query   limit
 */
router.get('/destructive', getDestructiveOperations);

/**
 * @route   GET /api/admin/audit/statistics
 * @desc    Get audit statistics
 * @access  Admin, Super Admin
 * @query   startDate, endDate
 */
router.get('/statistics', getAuditStatistics);

/**
 * @route   GET /api/admin/audit/resource/:resource/:id
 * @desc    Get audit logs for a specific resource
 * @access  Admin, Super Admin
 * @params  resource, id
 * @query   limit
 */
router.get('/resource/:resource/:id', getAuditLogsByResource);

/**
 * @route   GET /api/admin/audit/user/:userId
 * @desc    Get audit logs for a specific user
 * @access  Admin, Super Admin
 * @params  userId
 * @query   limit
 */
router.get('/user/:userId', getAuditLogsByUser);

/**
 * @route   GET /api/admin/audit/:id
 * @desc    Get audit log by ID
 * @access  Admin, Super Admin
 * @params  id
 */
router.get('/:id', getAuditLogById);

export default router;
