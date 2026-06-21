import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AdminUser } from '../models/AdminUser';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { logger } from '../utils/logger';

export class AuthController {
  /**
   * Connexion d'un utilisateur administrateur
   */
  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Log de la tentative de connexion
      logger.info(`Tentative de connexion pour ${email}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Authentifier l'utilisateur
      const { user, token } = await authService.authenticateUser(email, password);

      // Préparer la réponse (sans le mot de passe)
      const userResponse = user.toPublicJSON();

      const response: ApiResponse = {
        success: true,
        message: 'Connexion réussie',
        data: {
          user: userResponse,
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      // Log des échecs de connexion
      logger.warn(`Échec de connexion pour ${req.body.email}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
      
      next(error);
    }
  }

  /**
   * Rafraîchir le token d'authentification
   */
  public async refreshToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.get('Authorization');
      const oldToken = authHeader?.substring(7); // Supprimer "Bearer "

      if (!oldToken) {
        throw new ApiError(
          'Token requis pour le rafraîchissement',
          400,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const newToken = await authService.refreshToken(oldToken);

      const response: ApiResponse = {
        success: true,
        message: 'Token rafraîchi avec succès',
        data: {
          token: newToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Déconnexion d'un utilisateur
   */
  public async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await authService.logout(req.user.id);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Déconnexion réussie',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir le profil de l'utilisateur connecté
   */
  public async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(
          'Utilisateur non authentifié',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const user = await AdminUser.findById(req.user.id);
      
      if (!user) {
        throw new ApiError(
          'Utilisateur non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: user.toPublicJSON(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le profil de l'utilisateur connecté
   */
  public async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(
          'Utilisateur non authentifié',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const { firstName, lastName, avatar } = req.body;

      const user = await AdminUser.findById(req.user.id);
      
      if (!user) {
        throw new ApiError(
          'Utilisateur non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour les champs autorisés
      if (firstName !== undefined) user.firstName = firstName;
      if (lastName !== undefined) user.lastName = lastName;
      if (avatar !== undefined) user.avatar = avatar;

      await user.save();

      const response: ApiResponse = {
        success: true,
        message: 'Profil mis à jour avec succès',
        data: user.toPublicJSON(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changer le mot de passe de l'utilisateur connecté
   */
  public async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(
          'Utilisateur non authentifié',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(req.user.id, currentPassword, newPassword);

      const response: ApiResponse = {
        success: true,
        message: 'Mot de passe changé avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Demander une réinitialisation de mot de passe
   */
  public async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const resetToken = await authService.generatePasswordResetToken(email);

      // En production, envoyer le token par email
      // Pour le développement, on peut le retourner dans la réponse
      const response: ApiResponse = {
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
        ...(process.env.NODE_ENV === 'development' && { 
          data: { resetToken } 
        }),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réinitialiser le mot de passe avec un token
   */
  public async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      await authService.resetPassword(token, newPassword);

      const response: ApiResponse = {
        success: true,
        message: 'Mot de passe réinitialisé avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vérifier la validité d'un token
   */
  public async verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        throw new ApiError(
          'Token requis',
          400,
          ERROR_CODES.REQUIRED_FIELD
        );
      }

      const decoded = authService.verifyToken(token);

      // Vérifier que l'utilisateur existe toujours
      const user = await AdminUser.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        throw new ApiError(
          'Token invalide',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const response: ApiResponse = {
        success: true,
        message: 'Token valide',
        data: {
          valid: true,
          user: user.toPublicJSON(),
          expiresAt: new Date(decoded.exp! * 1000),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les permissions de l'utilisateur connecté
   */
  public async getPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ApiError(
          'Utilisateur non authentifié',
          401,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      const user = await AdminUser.findById(req.user.id);
      
      if (!user) {
        throw new ApiError(
          'Utilisateur non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: {
          role: user.role,
          permissions: user.permissions,
          isSuperAdmin: user.role === 'super_admin',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Instance du contrôleur d'authentification
export const authController = new AuthController();