import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AdminUser } from '../models/AdminUser';
import { ApiError, ERROR_CODES } from './errorHandler';
import { AuthenticatedRequest } from '../types';

// Export AuthRequest as alias for AuthenticatedRequest for backwards compatibility
export type AuthRequest = AuthenticatedRequest;

/**
 * Middleware d'authentification JWT
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Récupérer le token depuis l'header Authorization
    const authHeader = req.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(
        'Token d\'authentification requis',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const token = authHeader.substring(7); // Supprimer "Bearer "
    
    if (!token) {
      throw new ApiError(
        'Token d\'authentification requis',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Vérifier le token
    const decoded = authService.verifyToken(token);
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await AdminUser.findById(decoded.userId);
    
    if (!user) {
      throw new ApiError(
        'Utilisateur non trouvé',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    if (!user.isActive) {
      throw new ApiError(
        'Compte désactivé',
        401,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware d'autorisation basé sur les rôles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(
        'Authentification requise',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        'Permissions insuffisantes',
        403,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  };
};

/**
 * Middleware d'autorisation basé sur les permissions
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError(
          'Authentification requise',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      // Les super admins ont toutes les permissions
      if (req.user.role === 'super_admin') {
        return next();
      }

      // Vérifier les permissions spécifiques
      const hasPermission = await authService.validatePermission(
        req.user.id,
        resource,
        action
      );

      if (!hasPermission) {
        throw new ApiError(
          `Permission refusée pour ${action} sur ${resource}`,
          403,
          ERROR_CODES.ACCESS_DENIED
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware optionnel d'authentification (pour les routes publiques avec info utilisateur optionnelle)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Pas de token, continuer sans authentification
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Token vide, continuer sans authentification
    }

    try {
      // Vérifier le token
      const decoded = authService.verifyToken(token);
      
      // Récupérer l'utilisateur
      const user = await AdminUser.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        };
      }
    } catch (error) {
      // Ignorer les erreurs de token pour l'auth optionnelle
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de vérification du propriétaire de la ressource
 */
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(
        'Authentification requise',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Les super admins peuvent accéder à toutes les ressources
    if (req.user.role === 'super_admin') {
      return next();
    }

    const resourceId = req.params[resourceIdParam];
    
    // Vérifier si l'utilisateur est propriétaire de la ressource
    if (req.user.id !== resourceId) {
      throw new ApiError(
        'Accès refusé à cette ressource',
        403,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  };
};

/**
 * Middleware de limitation par rôle
 */
export const limitToRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError(
        'Authentification requise',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        `Accès limité aux rôles: ${roles.join(', ')}`,
        403,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  };
};

/**
 * Middleware de vérification de l'état du compte
 */
export const requireActiveAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(
        'Authentification requise',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Vérifier l'état du compte en temps réel
    const user = await AdminUser.findById(req.user.id);
    
    if (!user) {
      throw new ApiError(
        'Utilisateur non trouvé',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    if (!user.isActive) {
      throw new ApiError(
        'Compte désactivé',
        401,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    if (user.isLocked()) {
      throw new ApiError(
        'Compte temporairement verrouillé',
        423,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};