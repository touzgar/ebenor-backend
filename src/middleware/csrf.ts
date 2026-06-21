import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiError, ERROR_CODES } from './errorHandler';
import { AuthenticatedRequest } from '../types';

/**
 * Configuration CSRF
 */
const CSRF_CONFIG = {
  tokenLength: 32,
  cookieName: 'csrf-token',
  headerName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 heures
  },
};

/**
 * Génère un token CSRF aléatoire
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_CONFIG.tokenLength).toString('hex');
};

/**
 * Middleware pour générer et envoyer un token CSRF
 * Utilisé sur les routes qui nécessitent un token CSRF
 */
export const setCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Vérifier si un token existe déjà dans les cookies
    let token = req.cookies?.[CSRF_CONFIG.cookieName];

    // Si pas de token, en générer un nouveau
    if (!token) {
      token = generateCsrfToken();
      
      // Définir le cookie avec le token
      res.cookie(CSRF_CONFIG.cookieName, token, CSRF_CONFIG.cookieOptions);
    }

    // Ajouter le token à la réponse pour que le client puisse le récupérer
    res.locals.csrfToken = token;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour valider le token CSRF
 * Utilisé sur toutes les routes qui modifient l'état (POST, PUT, DELETE, PATCH)
 */
export const validateCsrfToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Ignorer la validation pour les requêtes GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Récupérer le token depuis le cookie
    const cookieToken = req.cookies?.[CSRF_CONFIG.cookieName];

    // Récupérer le token depuis le header
    const headerToken = req.get(CSRF_CONFIG.headerName);

    // Vérifier que les deux tokens existent
    if (!cookieToken || !headerToken) {
      throw new ApiError(
        'Token CSRF manquant',
        403,
        ERROR_CODES.CSRF_TOKEN_MISSING
      );
    }

    // Vérifier que les tokens correspondent (double-submit cookie pattern)
    if (cookieToken !== headerToken) {
      throw new ApiError(
        'Token CSRF invalide',
        403,
        ERROR_CODES.CSRF_TOKEN_INVALID
      );
    }

    // Token valide, continuer
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour rafraîchir le token CSRF après utilisation
 * Optionnel - peut être utilisé pour une sécurité renforcée
 */
export const refreshCsrfToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Générer un nouveau token
    const newToken = generateCsrfToken();

    // Mettre à jour le cookie
    res.cookie(CSRF_CONFIG.cookieName, newToken, CSRF_CONFIG.cookieOptions);

    // Ajouter le nouveau token à la réponse
    res.locals.csrfToken = newToken;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware pour exempter certaines routes de la validation CSRF
 * Utilisé pour les endpoints publics qui ne nécessitent pas de CSRF
 */
export const exemptCsrf = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Marquer la requête comme exemptée
  (req as any).csrfExempt = true;
  next();
};

/**
 * Middleware conditionnel qui valide CSRF seulement si non exempté
 */
export const conditionalCsrfValidation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Si la route est exemptée, passer
  if ((req as any).csrfExempt) {
    return next();
  }

  // Sinon, valider le token CSRF
  validateCsrfToken(req, res, next);
};

/**
 * Endpoint pour obtenir un token CSRF
 * GET /api/csrf-token
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const token = res.locals.csrfToken || req.cookies?.[CSRF_CONFIG.cookieName];

  if (!token) {
    res.status(500).json({
      success: false,
      message: 'Impossible de générer un token CSRF',
      code: 'CSRF_TOKEN_GENERATION_FAILED',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      csrfToken: token,
    },
  });
};

/**
 * Configuration pour exporter
 */
export const csrfConfig = {
  tokenLength: CSRF_CONFIG.tokenLength,
  cookieName: CSRF_CONFIG.cookieName,
  headerName: CSRF_CONFIG.headerName,
};
