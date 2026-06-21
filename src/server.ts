import 'dotenv/config'; // Load environment variables FIRST
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { 
  requestLogger, 
  sanitizeInput, 
  validateHeaders, 
  validatePayloadSize,
  timingAttackProtection 
} from './middleware/security';
import { setCsrfToken } from './middleware/csrf';

const app = express();
import { env } from './config/env';

const PORT = env.PORT;

// Configuration CORS
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
    ];

    // Permettre les requêtes sans origine en développement (Postman, curl, etc.)
    if (env.NODE_ENV === 'development' && !origin) {
      return callback(null, true);
    }

    // En développement, autoriser toute origine localhost (ports variables)
    if (env.NODE_ENV === 'development' && origin) {
      try {
        const host = new URL(origin).host;
        if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
          return callback(null, true);
        }
      } catch (e) {
        // fallthrough to default check
      }
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true, // Important pour les cookies CSRF
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'Cache-Control'],
  exposedHeaders: ['Set-Cookie'],
};

// Middlewares de sécurité et configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors(corsOptions));
app.use(compression({
  // Compression level (0-9, where 9 is maximum compression)
  level: 6,
  // Minimum response size to compress (in bytes)
  threshold: 1024, // 1KB
  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if client doesn't accept encoding
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter
    return compression.filter(req, res);
  },
}));
app.use(cookieParser()); // Cookie parser pour CSRF tokens

// Middlewares de logging et sécurité
app.use(requestLogger);
app.use(timingAttackProtection);
app.use(validatePayloadSize());
app.use(sanitizeInput);

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.NODE_ENV === 'development' ? 10000 : env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, réessayez plus tard.',
    code: 'TOO_MANY_REQUESTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'development', // Skip complètement en dev
});
app.use('/api/', limiter);

// Middlewares de parsing
app.use(validateHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF Protection - Générer un token pour toutes les requêtes
app.use(setCsrfToken);

// Route de santé
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

// Route pour obtenir un token CSRF
import { getCsrfToken } from './middleware/csrf';
app.get('/api/csrf-token', getCsrfToken);

// Routes API - PAS de validation CSRF globale
import apiRoutes from './routes';
// Désactiver les ETags pour les routes admin pour éviter le cache 304
app.set('etag', false);
app.use('/api', apiRoutes);

// Middleware de gestion des erreurs
app.use(notFound);
app.use(errorHandler);

// Démarrage du serveur
const startServer = async (): Promise<void> => {
  try {
    // Tentative de connexion à la base de données
    await config.connectDB();
    
    // Initialiser les modèles et créer les index seulement si MongoDB est connecté
    if (mongoose.connection.readyState === 1) {
      const { initializeModels, createIndexes } = await import('@/models');
      await initializeModels();
      await createIndexes();
    } else {
      logger.warn('⚠️ MongoDB non disponible - Les modèles ne seront pas initialisés');
    }
    
    app.listen(PORT, () => {
      logger.info(`🚀 Serveur ÉBENOR CRÉATION démarré sur le port ${PORT}`);
      logger.info(`📊 Environnement: ${env.NODE_ENV}`);
      logger.info(`🔗 API disponible sur: http://localhost:${PORT}/api`);
      logger.info(`🗄️ Base de données: ${mongoose.connection.readyState === 1 ? 'Connectée' : 'Non disponible'}`);
    });
  } catch (error) {
    logger.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion des signaux de fermeture
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu, fermeture gracieuse du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT reçu, fermeture gracieuse du serveur...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesse rejetée non gérée:', { reason, promise });
  process.exit(1);
});

// Démarrer le serveur
void startServer();

export default app;