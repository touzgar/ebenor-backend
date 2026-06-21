import { Request, Response, NextFunction } from 'express';
import { Message } from '../models/Message';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';
import { emailService } from '../services/emailService';

export class MessageController {
  /**
   * Créer un nouveau message de contact (route publique)
   */
  public async createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, phone, subject, message } = req.body;

      // Créer le message avec les informations de la requête
      const newMessage = new Message({
        name,
        email,
        phone,
        subject,
        message,
        source: 'contact_form',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      await newMessage.save();

      // Logger le nouveau message
      logger.info(`Nouveau message reçu de ${email}`, {
        messageId: newMessage._id,
        name,
        email,
        subject,
        priority: newMessage.priority,
        ip: req.ip,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Message envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
        data: {
          id: newMessage._id,
          status: newMessage.status,
          priority: newMessage.priority,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les messages avec pagination et filtres (route admin)
   */
  public async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Construire les filtres
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = req.query.status;
      }
      
      if (req.query.priority) {
        filters.priority = req.query.priority;
      }
      
      if (req.query.source) {
        filters.source = req.query.source;
      }

      // Filtre par date
      if (req.query.dateFrom || req.query.dateTo) {
        filters.createdAt = {};
        if (req.query.dateFrom) {
          filters.createdAt.$gte = new Date(req.query.dateFrom as string);
        }
        if (req.query.dateTo) {
          filters.createdAt.$lte = new Date(req.query.dateTo as string);
        }
      }

      // Recherche textuelle (nom uniquement)
      if (req.query.search) {
        const searchTerm = req.query.search as string;
        filters.name = { $regex: searchTerm, $options: 'i' };
      }

      // Tri
      let sort: any = { createdAt: -1 }; // Plus récents en premier par défaut
      
      if (req.query.sort) {
        const sortField = req.query.sort as string;
        if (sortField === 'priority') {
          sort = { priority: -1, createdAt: -1 }; // High, Medium, Low puis par date
        } else if (sortField === 'status') {
          sort = { status: 1, createdAt: -1 };
        } else if (sortField === 'name') {
          sort = { name: 1 };
        }
      }

      // Exécuter la requête avec pagination
      const [messages, total] = await Promise.all([
        Message.find(filters)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Message.countDocuments(filters)
      ]);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof messages[0]> = {
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir un message par son ID (route admin)
   */
  public async getMessageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marquer un message comme lu (route admin)
   */
  public async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      await message.markAsRead(userId);

      const response: ApiResponse = {
        success: true,
        message: 'Message marqué comme lu',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marquer un message comme répondu (route admin)
   */
  public async markAsReplied(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      await message.markAsReplied(userId);

      const response: ApiResponse = {
        success: true,
        message: 'Message marqué comme répondu',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ajouter une note à un message (route admin)
   */
  public async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const userId = (req as any).user?.id;

      if (!text || text.trim().length === 0) {
        throw new ApiError(
          'Le texte de la note est requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      await message.addNote(text.trim(), userId);

      const response: ApiResponse = {
        success: true,
        message: 'Note ajoutée avec succès',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changer la priorité d'un message (route admin)
   */
  public async changePriority(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      if (!['low', 'medium', 'high'].includes(priority)) {
        throw new ApiError(
          'Priorité invalide. Valeurs acceptées: low, medium, high',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      await message.setPriority(priority);

      const response: ApiResponse = {
        success: true,
        message: 'Priorité mise à jour avec succès',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archiver un message (route admin)
   */
  public async archiveMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const message = await Message.findByIdAndUpdate(
        id,
        { status: 'archived' },
        { new: true }
      );

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        message: 'Message archivé avec succès',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques des messages (route admin)
   */
  public async getMessageStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await Message.aggregate([
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            newMessages: {
              $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
            },
            readMessages: {
              $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
            },
            repliedMessages: {
              $sum: { $cond: [{ $eq: ['$status', 'replied'] }, 1, 0] }
            },
            archivedMessages: {
              $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
            },
            highPriorityMessages: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
            },
            mediumPriorityMessages: {
              $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
            },
            lowPriorityMessages: {
              $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
            }
          }
        }
      ]);

      // Statistiques par source
      const sourceStats = await Message.aggregate([
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        }
      ]);

      // Messages récents (7 derniers jours)
      const recentCount = await Message.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...(stats[0] || {
            totalMessages: 0,
            newMessages: 0,
            readMessages: 0,
            repliedMessages: 0,
            archivedMessages: 0,
            highPriorityMessages: 0,
            mediumPriorityMessages: 0,
            lowPriorityMessages: 0
          }),
          sourceStats,
          recentCount
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les messages non lus (route admin)
   */
  public async getUnreadMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await Message.find({ status: 'new' })
        .sort({ priority: -1, createdAt: -1 })
        .limit(limit)
        .select('name email subject priority createdAt')
        .lean();

      const response: ApiResponse = {
        success: true,
        data: messages,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Répondre à un message par email (route admin)
   */
  public async replyByEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { replyText } = req.body;

      if (!replyText || replyText.trim().length === 0) {
        throw new ApiError(
          'Le texte de la réponse est requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const message = await Message.findById(id);

      if (!message) {
        throw new ApiError(
          'Message non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Send email reply
      const subject = `Re: ${message.subject}`;
      const emailSent = await emailService.sendReplyEmail(
        message.email,
        subject,
        message.message,
        replyText.trim()
      );

      if (!emailSent) {
        throw new ApiError(
          'Erreur lors de l\'envoi de l\'email. Vérifiez la configuration SMTP.',
          500,
          ERROR_CODES.INTERNAL_ERROR
        );
      }

      // Mark as replied
      const userId = (req as any).user?.id || 'admin';
      await message.markAsReplied(userId);

      logger.info(`Email reply sent to ${message.email} for message ${id}`);

      const response: ApiResponse = {
        success: true,
        message: 'Réponse envoyée avec succès',
        data: message,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Instance du contrôleur de messages
export const messageController = new MessageController();