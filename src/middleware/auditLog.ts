import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { auditService } from '../services/auditService';

/**
 * Extract IP address from request
 */
function getIpAddress(req: AuthenticatedRequest): string | undefined {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    undefined
  );
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: AuthenticatedRequest): string | undefined {
  return req.headers['user-agent'];
}

/**
 * Middleware to log audit trail for operations
 */
export const auditLog = (
  action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'bulk_update' | 'login' | 'logout' | 'password_change' | 'upload' | 'download',
  resource: 'product' | 'gallery' | 'home' | 'message' | 'user' | 'media' | 'auth'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Flag to ensure we only log once
    let logged = false;

    // Wrapper function to log after response
    const logAudit = async (body: any) => {
      if (logged) return;
      logged = true;

      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const resourceId = req.params.id || body?.data?._id || body?.data?.id;
          
          await auditService.createAuditLog({
            userId: req.user.id,
            userEmail: req.user.email,
            action,
            resource,
            resourceId,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode
            }
          });
        } catch (error) {
          // Silently fail - don't break the main operation
          console.error('Audit logging failed:', error);
        }
      }
    };

    // Override res.json
    res.json = function(body: any) {
      logAudit(body).finally(() => {
        originalJson(body);
      });
      return res;
    };

    // Override res.send
    res.send = function(body: any) {
      logAudit(body).finally(() => {
        originalSend(body);
      });
      return res;
    };

    next();
  };
};

/**
 * Middleware to log audit trail with before/after changes
 */
export const auditLogWithChanges = (
  action: 'update' | 'delete',
  resource: 'product' | 'gallery' | 'home' | 'message' | 'user',
  getBeforeState: (req: AuthenticatedRequest) => Promise<any>
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      return next();
    }

    try {
      // Capture before state
      const beforeState = await getBeforeState(req);

      // Store original methods
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      // Flag to ensure we only log once
      let logged = false;

      // Wrapper function to log after response
      const logAudit = async (body: any) => {
        if (logged) return;
        logged = true;

        // Only log successful operations (2xx status codes)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const resourceId = req.params.id || body?.data?._id || body?.data?.id;
            const afterState = action === 'delete' ? null : body?.data;

            await auditService.createAuditLog({
              userId: req.user!.id,
              userEmail: req.user!.email,
              action,
              resource,
              resourceId,
              changes: {
                before: beforeState,
                after: afterState
              },
              ipAddress: getIpAddress(req),
              userAgent: getUserAgent(req),
              metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode
              }
            });
          } catch (error) {
            console.error('Audit logging failed:', error);
          }
        }
      };

      // Override res.json
      res.json = function(body: any) {
        logAudit(body).finally(() => {
          originalJson(body);
        });
        return res;
      };

      // Override res.send
      res.send = function(body: any) {
        logAudit(body).finally(() => {
          originalSend(body);
        });
        return res;
      };

      next();
    } catch (error) {
      // If we can't get before state, continue without audit logging
      console.error('Failed to get before state for audit:', error);
      next();
    }
  };
};

/**
 * Middleware to log bulk operations
 */
export const auditLogBulk = (
  action: 'bulk_delete' | 'bulk_update',
  resource: 'product' | 'gallery' | 'message'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Flag to ensure we only log once
    let logged = false;

    // Wrapper function to log after response
    const logAudit = async (body: any) => {
      if (logged) return;
      logged = true;

      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const affectedIds = req.body.ids || [];
          
          await auditService.createAuditLog({
            userId: req.user.id,
            userEmail: req.user.email,
            action,
            resource,
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              affectedIds,
              count: affectedIds.length
            }
          });
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      }
    };

    // Override res.json
    res.json = function(body: any) {
      logAudit(body).finally(() => {
        originalJson(body);
      });
      return res;
    };

    // Override res.send
    res.send = function(body: any) {
      logAudit(body).finally(() => {
        originalSend(body);
      });
      return res;
    };

    next();
  };
};

/**
 * Middleware to log authentication events
 */
export const auditLogAuth = (
  action: 'login' | 'logout' | 'password_change'
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Flag to ensure we only log once
    let logged = false;

    // Wrapper function to log after response
    const logAudit = async (body: any) => {
      if (logged) return;
      logged = true;

      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // For login, user might not be in req.user yet, get from body
          const userId = req.user?.id || body?.data?.user?.id || body?.data?.user?._id;
          const userEmail = req.user?.email || body?.data?.user?.email || req.body?.email;

          if (userId) {
            await auditService.createAuditLog({
              userId,
              userEmail,
              action,
              resource: 'auth',
              ipAddress: getIpAddress(req),
              userAgent: getUserAgent(req),
              metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode
              }
            });
          }
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      }
    };

    // Override res.json
    res.json = function(body: any) {
      logAudit(body).finally(() => {
        originalJson(body);
      });
      return res;
    };

    // Override res.send
    res.send = function(body: any) {
      logAudit(body).finally(() => {
        originalSend(body);
      });
      return res;
    };

    next();
  };
};
