import { Request, Response, NextFunction } from 'express';
import { GalleryImage } from '../models/GalleryImage';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';
import { MockDataService } from '../services/mockDataService';

export class GalleryController {
  /**
   * Obtenir toutes les images de la galerie avec pagination et filtres
   */
  public async getGalleryImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let images, total;
      
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        // Construire les filtres
        const filters: any = {};
        
        if (req.query.category) {
          filters.category = req.query.category;
        }
        
        if (req.query.featured !== undefined) {
          filters.featured = req.query.featured === 'true';
        }

        if (req.query.tags) {
          const tags = Array.isArray(req.query.tags) 
            ? req.query.tags 
            : [req.query.tags];
          filters.tags = { $in: tags };
        }

        // Recherche textuelle
        if (req.query.search) {
          filters.$text = { $search: req.query.search };
        }

        // Tri
        let sort: any = { sortOrder: 1, uploadedAt: -1 }; // Par ordre puis par date
        
        if (req.query.sort) {
          const sortField = req.query.sort as string;
          // Handle both "date" and "date:1" or "date:-1" formats
          if (sortField === 'date' || sortField.startsWith('date:')) {
            const direction = sortField.includes(':-1') ? 1 : -1;
            sort = { uploadedAt: direction };
          } else if (sortField === 'title' || sortField.startsWith('title:')) {
            const direction = sortField.includes(':-1') ? -1 : 1;
            sort = { title: direction };
          } else if (sortField === 'featured' || sortField.startsWith('featured:')) {
            sort = { featured: -1, sortOrder: 1 };
          }
        }

        // Exécuter la requête avec pagination
        [images, total] = await Promise.all([
          GalleryImage.find(filters)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
          GalleryImage.countDocuments(filters)
        ]);
      } catch (dbError) {
        // Si MongoDB n'est pas disponible, utiliser les données de test
        logger.warn('MongoDB non disponible, utilisation des données de test pour la galerie', { error: dbError });
        const mockImages = MockDataService.getGalleryImages();
        
        // Appliquer les filtres basiques sur les données de test
        let filteredImages = mockImages;
        
        if (req.query.category) {
          filteredImages = filteredImages.filter(img => img.category === req.query.category);
        }
        
        if (req.query.featured !== undefined) {
          const featured = req.query.featured === 'true';
          filteredImages = filteredImages.filter(img => img.featured === featured);
        }
        
        images = filteredImages;
        total = filteredImages.length;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof images[0]> = {
        success: true,
        data: images,
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
   * Obtenir une image par son ID
   */
  public async getImageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const image = await GalleryImage.findById(id).lean();

      if (!image) {
        throw new ApiError(
          'Image non trouvée',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: image,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les images en vedette
   */
  public async getFeaturedImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let images;
      
      try {
        const limit = parseInt(req.query.limit as string) || 12;

        images = await GalleryImage.find({ featured: true })
          .sort({ sortOrder: 1, uploadedAt: -1 })
          .limit(limit)
          .lean();
      } catch (dbError) {
        // Si MongoDB n'est pas disponible, utiliser les données de test
        logger.warn('MongoDB non disponible, utilisation des données de test pour les images en vedette', { error: dbError });
        const mockImages = MockDataService.getGalleryImages();
        const limit = parseInt(req.query.limit as string) || 12;
        images = mockImages.filter(img => img.featured).slice(0, limit);
      }

      const response: ApiResponse = {
        success: true,
        data: images,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les images par catégorie
   */
  public async getImagesByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;

      const [images, total] = await Promise.all([
        GalleryImage.find({ category })
          .sort({ sortOrder: 1, uploadedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        GalleryImage.countDocuments({ category })
      ]);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof images[0]> = {
        success: true,
        data: images,
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
   * Obtenir les catégories d'images disponibles
   */
  public async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await GalleryImage.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            featuredCount: {
              $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] }
            },
            tags: { $addToSet: '$tags' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            featuredCount: 1,
            tags: {
              $reduce: {
                input: '$tags',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          }
        },
        { $sort: { category: 1 } }
      ]);

      const response: ApiResponse = {
        success: true,
        data: categories,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir tous les tags disponibles
   */
  public async getTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await GalleryImage.aggregate([
        { $unwind: '$tags' },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            tag: '$_id',
            count: 1
          }
        },
        { $sort: { count: -1, tag: 1 } }
      ]);

      const response: ApiResponse = {
        success: true,
        data: tags,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rechercher des images
   */
  public async searchImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        throw new ApiError(
          'Terme de recherche requis (minimum 2 caractères)',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const searchTerm = q.trim();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      // Recherche avec score de pertinence
      const images = await GalleryImage.find(
        { $text: { $search: searchTerm } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' }, uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await GalleryImage.countDocuments({
        $text: { $search: searchTerm }
      });

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof images[0]> = {
        success: true,
        data: images,
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
   * Obtenir les statistiques de la galerie
   */
  public async getGalleryStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await GalleryImage.aggregate([
        {
          $group: {
            _id: null,
            totalImages: { $sum: 1 },
            featuredImages: {
              $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] }
            },
            categoriesCount: { $addToSet: '$category' },
            totalSize: { $sum: '$fileSize' },
            avgSize: { $avg: '$fileSize' },
            formats: { $addToSet: '$mimeType' }
          }
        },
        {
          $project: {
            _id: 0,
            totalImages: 1,
            featuredImages: 1,
            categoriesCount: { $size: '$categoriesCount' },
            totalSize: { $round: [{ $divide: ['$totalSize', 1048576] }, 2] }, // MB
            avgSize: { $round: [{ $divide: ['$avgSize', 1048576] }, 2] }, // MB
            formatsCount: { $size: '$formats' }
          }
        }
      ]);

      const response: ApiResponse = {
        success: true,
        data: stats[0] || {
          totalImages: 0,
          featuredImages: 0,
          categoriesCount: 0,
          totalSize: 0,
          avgSize: 0,
          formatsCount: 0
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir une galerie masonry (pour l'affichage en grille)
   */
  public async getMasonryGallery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const category = req.query.category as string;

      const filters: any = {};
      if (category) {
        filters.category = category;
      }

      // Récupérer les images avec leurs dimensions pour le masonry
      const images = await GalleryImage.find(filters)
        .select('title url thumbnailUrl alt dimensions category tags featured')
        .sort({ featured: -1, sortOrder: 1, uploadedAt: -1 })
        .limit(limit)
        .lean();

      // Organiser les images par ratio pour un meilleur affichage masonry
      const organizedImages = images.map(image => ({
        ...image,
        aspectRatio: image.dimensions.width / image.dimensions.height,
        isLandscape: image.dimensions.width > image.dimensions.height,
        isPortrait: image.dimensions.height > image.dimensions.width,
        isSquare: image.dimensions.width === image.dimensions.height
      }));

      const response: ApiResponse = {
        success: true,
        data: organizedImages,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Upload image or video to gallery (Admin only)
   */
  public async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Handle both single file and files array from upload.any()
      const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : null);
      
      if (!file) {
        throw new ApiError(
          'Fichier requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Import file upload service
      const { fileUploadService } = await import('@/services/fileUploadService');

      // Determine if file is image or video based on mimetype
      const isVideo = file.mimetype.startsWith('video/');
      const isImage = file.mimetype.startsWith('image/');

      if (!isImage && !isVideo) {
        throw new ApiError(
          'Type de fichier non supporté',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Upload file (image or video)
      const uploadResult = isVideo 
        ? await fileUploadService.uploadVideo(file, 'gallery')
        : await fileUploadService.uploadImage(file, 'gallery');

      // Parse tags if they are a string
      let tags: string[] = [];
      if (req.body.tags) {
        try {
          tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
        } catch (e) {
          tags = [];
        }
      }

      // Create gallery image record
      const imageData: any = {
        title: req.body.title || file.originalname.replace(/\.[^/.]+$/, ''),
        description: req.body.description || '',
        alt: req.body.alt || file.originalname.replace(/\.[^/.]+$/, ''),
        url: uploadResult.secure_url || uploadResult.url,
        thumbnailUrl: uploadResult.secure_url || uploadResult.url,
        category: req.body.category || 'Général',
        tags: tags,
        featured: req.body.featured === 'true' || false,
        dimensions: {
          width: uploadResult.width || 0,
          height: uploadResult.height || 0,
        },
        fileSize: uploadResult.bytes || file.size,
        mimeType: file.mimetype,
        cloudinaryId: uploadResult.public_id,
      };

      // Add uploadedBy if user exists
      const authenticatedReq = req as any;
      if (authenticatedReq.user) {
        imageData.uploadedBy = authenticatedReq.user.id;
      }

      const image = new GalleryImage(imageData);
      await image.save();

      logger.info(`Gallery ${isVideo ? 'video' : 'image'} uploaded and created`, { 
        imageId: image._id, 
        title: image.title,
        url: image.url,
        type: isVideo ? 'video' : 'image',
      });

      const response: ApiResponse = {
        success: true,
        data: image.toPublicJSON(),
        message: `${isVideo ? 'Vidéo' : 'Image'} téléchargée et ajoutée à la galerie avec succès`,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une nouvelle image de galerie (Admin only)
   */
  public async createGalleryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const imageData: any = req.body;

      // Add uploadedBy if user exists
      const authenticatedReq = req as any;
      if (authenticatedReq.user) {
        imageData.uploadedBy = authenticatedReq.user.id;
      }

      // Créer l'image
      const image = new GalleryImage(imageData);
      await image.save();

      logger.info('Gallery image created', { imageId: image._id, title: image.title });

      const response: ApiResponse = {
        success: true,
        data: image.toPublicJSON(),
        message: 'Image ajoutée à la galerie avec succès',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour une image de galerie (Admin only)
   */
  public async updateGalleryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const image = await GalleryImage.findById(id);

      if (!image) {
        throw new ApiError(
          'Image non trouvée',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour les champs
      Object.assign(image, updateData);
      await image.save();

      logger.info('Gallery image updated', { imageId: image._id, title: image.title });

      const response: ApiResponse = {
        success: true,
        data: image.toPublicJSON(),
        message: 'Image mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer une image de galerie (Admin only)
   */
  public async deleteGalleryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const image = await GalleryImage.findById(id);

      if (!image) {
        throw new ApiError(
          'Image non trouvée',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      await GalleryImage.findByIdAndDelete(id);

      logger.info('Gallery image deleted', { imageId: id, title: image.title });

      const response: ApiResponse = {
        success: true,
        message: 'Image supprimée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Opérations en masse sur les images (Admin only)
   */
  public async bulkOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, imageIds, data } = req.body;

      // Special case: deleteAll doesn't need imageIds
      if (action === 'deleteAll') {
        const result = await GalleryImage.deleteMany({});
        logger.info('Delete ALL gallery images', { 
          count: result.deletedCount,
          deletedBy: req.user?.email || req.user?.id,
        });

        const response: ApiResponse = {
          success: true,
          data: { deletedCount: result.deletedCount },
          message: `${result.deletedCount} image(s) supprimée(s) avec succès`,
        };

        res.status(200).json(response);
        return;
      }

      if (!action || !imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        throw new ApiError(
          'Action et IDs d\'images requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let result;

      switch (action) {
        case 'delete':
          result = await GalleryImage.deleteMany({ _id: { $in: imageIds } });
          logger.info('Bulk delete gallery images', { count: result.deletedCount });
          break;

        case 'feature':
          result = await GalleryImage.updateMany(
            { _id: { $in: imageIds } },
            { $set: { featured: true } }
          );
          logger.info('Bulk feature gallery images', { count: result.modifiedCount });
          break;

        case 'unfeature':
          result = await GalleryImage.updateMany(
            { _id: { $in: imageIds } },
            { $set: { featured: false } }
          );
          logger.info('Bulk unfeature gallery images', { count: result.modifiedCount });
          break;

        case 'changeCategory':
          if (!data || !data.category) {
            throw new ApiError(
              'Catégorie requise pour cette action',
              400,
              ERROR_CODES.VALIDATION_ERROR
            );
          }
          result = await GalleryImage.updateMany(
            { _id: { $in: imageIds } },
            { $set: { category: data.category } }
          );
          logger.info('Bulk change category', { count: result.modifiedCount, category: data.category });
          break;

        default:
          throw new ApiError(
            'Action non reconnue',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
      }

      const response: ApiResponse = {
        success: true,
        data: result,
        message: `Opération "${action}" effectuée avec succès`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour l'ordre des images (Admin only)
   */
  public async updateSortOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imageOrders } = req.body;

      if (!imageOrders || !Array.isArray(imageOrders)) {
        throw new ApiError(
          'Ordre des images requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Mettre à jour l'ordre de chaque image
      const updatePromises = imageOrders.map(({ id, sortOrder }) =>
        GalleryImage.findByIdAndUpdate(id, { sortOrder })
      );

      await Promise.all(updatePromises);

      logger.info('Gallery images sort order updated', { count: imageOrders.length });

      const response: ApiResponse = {
        success: true,
        message: 'Ordre des images mis à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cleanup orphaned gallery images (Admin only)
   * Removes gallery images that don't belong to any existing product
   */
  public async cleanupOrphanedImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Product } = await import('../models/Product');
      const { cloudinaryService } = await import('../services/cloudinaryService');

      // Get all products and their image URLs
      const products = await Product.find({}).lean();
      const productImageUrls = new Set<string>();
      
      products.forEach(product => {
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img: any) => {
            if (img.url) {
              productImageUrls.add(img.url);
            }
          });
        }
      });

      // Get all gallery images
      const galleryImages = await GalleryImage.find({}).lean();

      // Find orphaned images (gallery images not referenced by any product)
      const orphanedImages = galleryImages.filter(img => !productImageUrls.has(img.url));

      if (orphanedImages.length === 0) {
        const response: ApiResponse = {
          success: true,
          data: {
            orphanedCount: 0,
            deletedCount: 0,
            cloudinaryDeletedCount: 0,
          },
          message: 'Aucune image orpheline trouvée. La galerie est propre!',
        };
        res.status(200).json(response);
        return;
      }

      // Delete orphaned images from database
      const orphanedUrls = orphanedImages.map(img => img.url);
      const deleteResult = await GalleryImage.deleteMany({
        url: { $in: orphanedUrls }
      });

      // Delete from Cloudinary
      let cloudinaryDeletedCount = 0;
      for (const img of orphanedImages) {
        try {
          const urlMatch = img.url.match(/\/([^/]+)\.(jpg|jpeg|png|webp|mp4|mov)$/i);
          if (urlMatch && urlMatch[1]) {
            const publicId = `ebenor-creation/products/${urlMatch[1]}`;
            await cloudinaryService.deleteFile(publicId, 'image');
            cloudinaryDeletedCount++;
          }
        } catch (error) {
          logger.warn('Failed to delete orphaned image from Cloudinary', {
            url: img.url,
            error
          });
        }
      }

      logger.info('Cleanup orphaned gallery images', {
        orphanedCount: orphanedImages.length,
        deletedFromDB: deleteResult.deletedCount,
        deletedFromCloudinary: cloudinaryDeletedCount,
        cleanedBy: req.user?.email || req.user?.id,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          orphanedCount: orphanedImages.length,
          deletedCount: deleteResult.deletedCount,
          cloudinaryDeletedCount,
          orphanedImages: orphanedImages.map(img => ({
            title: img.title,
            url: img.url,
            category: img.category,
          })),
        },
        message: `${deleteResult.deletedCount} image(s) orpheline(s) supprimée(s) avec succès!`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Instance du contrôleur de galerie
export const galleryController = new GalleryController();
