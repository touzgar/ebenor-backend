import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import * as DOMPurify from 'isomorphic-dompurify';
import { ApiError, ERROR_CODES } from './errorHandler';

// Rate limiting pour l'authentification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 5, // 1000 en dev, 5 en prod
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    code: 'TOO_MANY_REQUESTS'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1', // Skip pour localhost en dev
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives de connexion depuis cette IP. Réessayez dans 15 minutes.',
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      retryAfter: 900, // 15 minutes in seconds
    });
  },
});

// Rate limiting pour les uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // 100 en dev, 10 en prod
  message: {
    success: false,
    message: 'Trop d\'uploads. Réessayez dans une minute.',
    code: 'TOO_MANY_UPLOADS'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Trop d\'uploads depuis cette IP. Réessayez dans une minute.',
      code: 'TOO_MANY_UPLOADS',
      retryAfter: 60, // seconds
    });
  },
});

// Rate limiting pour les messages de contact
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // 100 en dev, 10 en prod (augmenté de 3 à 10)
  message: {
    success: false,
    message: 'Trop de messages envoyés. Réessayez dans une heure.',
    code: 'TOO_MANY_MESSAGES'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV === 'development', // Skip complètement en mode développement
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Trop de messages envoyés depuis cette IP. Réessayez dans une heure.',
      code: 'TOO_MANY_CONTACT_MESSAGES',
      retryAfter: 3600, // 1 hour in seconds
    });
  },
});

// Middleware de validation des headers requis
export const validateHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Vérifier Content-Type pour les requêtes POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
      throw new ApiError(
        'Content-Type doit être application/json ou multipart/form-data',
        400,
        ERROR_CODES.INVALID_FORMAT
      );
    }
  }
  
  next();
};

/**
 * Configuration DOMPurify pour la sanitisation HTML
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

/**
 * Sanitise une chaîne HTML pour prévenir les attaques XSS
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') return html;
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
};

/**
 * Sanitise une chaîne de texte simple (pas de HTML autorisé)
 */
export const sanitizeText = (text: string): string => {
  if (typeof text !== 'string') return text;
  
  // Supprimer tous les tags HTML
  let sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  
  // Supprimer les protocoles dangereux
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '');
  
  // Supprimer les event handlers
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized.trim();
};

/**
 * Sanitise une URL
 */
export const sanitizeUrl = (url: string): string => {
  if (typeof url !== 'string') return url;
  
  // Autoriser seulement http, https et les chemins relatifs
  const urlPattern = /^(https?:\/\/|\/)/i;
  
  if (!urlPattern.test(url)) {
    return '';
  }
  
  // Supprimer les protocoles dangereux
  return url
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .trim();
};

/**
 * Sanitise un chemin de fichier pour prévenir les attaques de traversée de répertoire
 */
export const sanitizeFilePath = (path: string): string => {
  if (typeof path !== 'string') return path;
  
  // Supprimer les tentatives de traversée de répertoire
  return path
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '')
    .trim();
};

/**
 * Middleware de sanitisation des entrées
 * Applique la sanitisation appropriée selon le type de données
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Fonction récursive pour nettoyer les objets
  const sanitize = (obj: any, isHtmlField: boolean = false): any => {
    if (typeof obj === 'string') {
      // Appliquer la sanitisation appropriée
      if (isHtmlField) {
        return sanitizeHtml(obj);
      }
      return sanitizeText(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item, isHtmlField));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Les champs de description peuvent contenir du HTML
          const isHtml = key.includes('description') || key.includes('Description') || 
                        key === 'text' || key === 'content';
          sanitized[key] = sanitize(obj[key], isHtml);
        }
      }
      return sanitized;
    }
    
    return obj;
  };
  
  // Sanitiser le body, query et params
  if (req.body) {
    req.body = sanitize(req.body);
  }
  
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  if (req.params) {
    req.params = sanitize(req.params);
  }
  
  next();
};

// Middleware de validation de l'origine
export const validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  const origin = req.get('Origin');
  
  // Permettre les requêtes sans origine (Postman, curl, etc.) en développement
  if (process.env.NODE_ENV === 'development' && !origin) {
    return next();
  }
  
  if (origin && !allowedOrigins.includes(origin)) {
    throw new ApiError(
      'Origine non autorisée',
      403,
      ERROR_CODES.ACCESS_DENIED
    );
  }
  
  next();
};

// Middleware de logging des requêtes
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Log de la requête entrante
  console.log(`📥 ${req.method} ${req.url} - IP: ${req.ip} - UA: ${req.get('User-Agent')?.substring(0, 50)}...`);
  
  // Intercepter la réponse pour logger la durée
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢';
    console.log(`📤 ${statusColor} ${res.statusCode} ${req.method} ${req.url} - ${duration}ms`);
    return originalSend.call(this, body);
  };
  
  next();
};

// Middleware de validation de la taille du payload
export const validatePayloadSize = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new ApiError(
        `Payload trop volumineux. Maximum autorisé: ${maxSize / (1024 * 1024)}MB`,
        413,
        ERROR_CODES.FILE_TOO_LARGE
      );
    }
    
    next();
  };
};

// Middleware de protection contre les attaques de timing
export const timingAttackProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Ajouter un délai aléatoire pour les routes sensibles
  const sensitiveRoutes = ['/api/auth/login', '/api/admin'];
  const isSensitive = sensitiveRoutes.some(route => req.path.startsWith(route));
  
  if (isSensitive) {
    const delay = Math.random() * 100; // 0-100ms de délai aléatoire
    setTimeout(() => next(), delay);
  } else {
    next();
  }
};

// Middleware de validation des paramètres MongoDB ObjectId
export const validateObjectId = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];
    
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new ApiError(
        'ID invalide',
        400,
        ERROR_CODES.INVALID_FORMAT
      );
    }
    
    next();
  };
};