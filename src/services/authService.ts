import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AdminUser, AdminUserDocument } from '../models/AdminUser';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { JWTPayload } from '../types';
import { logger } from '../utils/logger';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    if (process.env.NODE_ENV === 'production' && this.jwtSecret === 'fallback-secret-key-change-in-production') {
      logger.error('⚠️ JWT_SECRET non configuré en production !');
      throw new Error('JWT_SECRET doit être configuré en production');
    }
  }

  /**
   * Générer un token JWT
   */
  public generateToken(user: AdminUserDocument): string {
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
    };

    // Explicitly type the SignOptions - cast expiresIn to satisfy StringValue type
    const signOptions: SignOptions = {
      expiresIn: this.jwtExpiresIn as any, // StringValue from 'ms' package
      issuer: 'ebenor-creation-api',
      audience: 'ebenor-creation-frontend',
    };

    return jwt.sign(payload, this.jwtSecret, signOptions);
  }

  /**
   * Vérifier et décoder un token JWT
   */
  public verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'ebenor-creation-api',
        audience: 'ebenor-creation-frontend',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(
          'Token expiré',
          401,
          ERROR_CODES.EXPIRED_TOKEN
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(
          'Token invalide',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      throw new ApiError(
        'Erreur de vérification du token',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  /**
   * Hasher un mot de passe
   */
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Comparer un mot de passe avec son hash
   */
  public async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Authentifier un utilisateur
   */
  public async authenticateUser(email: string, password: string): Promise<{
    user: AdminUserDocument;
    token: string;
  }> {
    // Rechercher l'utilisateur par email
    const user = await AdminUser.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      throw new ApiError(
        'Email ou mot de passe incorrect',
        401,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      throw new ApiError(
        'Compte désactivé',
        401,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    // Vérifier si le compte est verrouillé
    if (user.isLocked()) {
      const lockTime = user.lockUntil ? new Date(user.lockUntil) : new Date();
      const remainingTime = Math.ceil((lockTime.getTime() - Date.now()) / (1000 * 60));
      
      throw new ApiError(
        `Compte verrouillé. Réessayez dans ${remainingTime} minutes.`,
        423,
        ERROR_CODES.ACCESS_DENIED
      );
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Incrémenter les tentatives de connexion
      await user.incrementLoginAttempts();
      
      throw new ApiError(
        'Email ou mot de passe incorrect',
        401,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Réinitialiser les tentatives de connexion en cas de succès
    await user.resetLoginAttempts();

    // Générer le token
    const token = this.generateToken(user);

    // Logger la connexion réussie
    logger.info(`Connexion réussie pour ${user.email}`, {
      userId: user._id,
      email: user.email,
      role: user.role,
      ip: 'unknown', // Sera ajouté par le contrôleur
    });

    return { user, token };
  }

  /**
   * Rafraîchir un token
   */
  public async refreshToken(oldToken: string): Promise<string> {
    try {
      // Décoder le token sans vérifier l'expiration
      const decoded = jwt.decode(oldToken) as JWTPayload;
      
      if (!decoded || !decoded.userId) {
        throw new ApiError(
          'Token invalide',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      // Récupérer l'utilisateur
      const user = await AdminUser.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new ApiError(
          'Utilisateur non trouvé ou inactif',
          401,
          ERROR_CODES.ACCESS_DENIED
        );
      }

      // Générer un nouveau token
      return this.generateToken(user);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        'Impossible de rafraîchir le token',
        401,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  /**
   * Valider les permissions d'un utilisateur
   */
  public async validatePermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await AdminUser.findById(userId);
    
    if (!user || !user.isActive) {
      return false;
    }

    return user.hasPermission(resource, action);
  }

  /**
   * Générer un token de réinitialisation de mot de passe
   */
  public async generatePasswordResetToken(email: string): Promise<string> {
    const user = await AdminUser.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Ne pas révéler si l'email existe ou non
      throw new ApiError(
        'Si cet email existe, un lien de réinitialisation a été envoyé',
        200
      );
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    logger.info(`Token de réinitialisation généré pour ${email}`);
    
    return resetToken;
  }

  /**
   * Réinitialiser le mot de passe avec un token
   */
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await AdminUser.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new ApiError(
        'Token de réinitialisation invalide ou expiré',
        400,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();

    logger.info(`Mot de passe réinitialisé pour ${user.email}`);
  }

  /**
   * Changer le mot de passe d'un utilisateur connecté
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await AdminUser.findById(userId);
    
    if (!user) {
      throw new ApiError(
        'Utilisateur non trouvé',
        404,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      throw new ApiError(
        'Mot de passe actuel incorrect',
        400,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Mettre à jour le mot de passe
    user.password = newPassword;
    await user.save();

    logger.info(`Mot de passe changé pour ${user.email}`);
  }

  /**
   * Déconnecter un utilisateur (blacklist du token côté client)
   */
  public async logout(userId: string): Promise<void> {
    const user = await AdminUser.findById(userId);
    
    if (user) {
      logger.info(`Déconnexion de ${user.email}`);
    }
    
    // Note: Dans une implémentation complète, on pourrait maintenir
    // une blacklist des tokens côté serveur ou utiliser Redis
  }
}

// Instance singleton du service d'authentification
export const authService = new AuthService();