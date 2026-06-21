import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Codes d'erreur standardisés
export const ERROR_CODES = {
  // Authentification
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // CSRF Protection
  CSRF_TOKEN_MISSING: 'CSRF_TOKEN_MISSING',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Ressources
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  CONFLICT: 'CONFLICT',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  
  // Upload
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // Système
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Middleware de gestion d'erreurs global
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;
  
  // Erreurs Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new ApiError(message, 400, ERROR_CODES.VALIDATION_ERROR);
  }
  
  // Erreurs de duplication MongoDB
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const message = `${field} existe déjà`;
    error = new ApiError(message, 400, ERROR_CODES.DUPLICATE_ERROR);
  }
  
  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError('Token invalide', 401, ERROR_CODES.INVALID_TOKEN);
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new ApiError('Token expiré', 401, ERROR_CODES.EXPIRED_TOKEN);
  }
  
  // Erreurs de cast MongoDB
  if (err.name === 'CastError') {
    const message = 'Ressource non trouvée';
    error = new ApiError(message, 404, ERROR_CODES.NOT_FOUND);
  }
  
  // Log de l'erreur
  const errorLog = {
    message: error.message,
    statusCode: (error as ApiError).statusCode || 500,
    code: (error as ApiError).code,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  };
  
  if ((error as ApiError).statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else {
    logger.warn('Client Error:', errorLog);
  }
  
  // Réponse d'erreur
  const response: any = {
    success: false,
    message: error.message,
    code: (error as ApiError).code,
  };
  
  // Toujours renvoyer les détails de validation si présents, peu importe l'environnement
  if ((error as ApiError).details) {
    response.details = (error as ApiError).details;
  }
  
  // Ajouter la stack trace uniquement en développement
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }
  
  res.status((error as ApiError).statusCode || 500).json(response);
};

// Middleware pour les routes non trouvées
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new ApiError(
    `Route ${req.originalUrl} non trouvée`,
    404,
    ERROR_CODES.NOT_FOUND
  );
  next(error);
};