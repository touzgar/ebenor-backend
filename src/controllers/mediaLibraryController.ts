import { Request, Response, NextFunction } from 'express';
import { mediaLibraryService } from '../services/mediaLibraryService';
import { uploadThingService } from '../services/uploadThingService';
import { cloudinaryService } from '../services/cloudinaryService';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';

export class MediaLibraryController {
  /**
   * Get all media with pagination and filters
   * GET /api/admin/media
   */
  public async getAllMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Build filters
      const filters: any = {};

      if (req.query.type) {
        filters.type = req.query.type;
      }

      if (req.query.category) {
        filters.category = req.query.category;
      }

      if (req.query.source) {
        filters.source = req.query.source;
      }

      if (req.query.search) {
        filters.search = req.query.search;
      }

      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom as string);
      }

      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo as string);
      }

      // Fetch media
      const { media, total } = await mediaLibraryService.getAllMedia(page, limit, filters);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof media[0]> = {
        success: true,
        data: media,
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
   * Get media library statistics
   * GET /api/admin/media/stats
   */
  public async getMediaStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await mediaLibraryService.getMediaStats();

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Find references for a specific media URL
   * GET /api/admin/media/references
   */
  public async findMediaReferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        throw new ApiError('URL du média requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const references = await mediaLibraryService.findMediaReferences(url);

      const response: ApiResponse = {
        success: true,
        data: {
          url,
          references,
          count: references.length,
          inUse: references.length > 0,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete media
   * DELETE /api/admin/media
   */
  public async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        throw new ApiError('URL du média requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const result = await mediaLibraryService.deleteMedia(url);

      if (!result.deleted) {
        const response: ApiResponse = {
          success: false,
          message: 'Le média ne peut pas être supprimé car il est utilisé',
          data: {
            references: result.references,
            count: result.references.length,
          },
        };
        res.status(409).json(response);
        return;
      }

      logger.info('Media deleted', { url });

      const response: ApiResponse = {
        success: true,
        message: 'Média supprimé avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete all media
   * DELETE /api/admin/media/all
   */
  public async deleteAllMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await mediaLibraryService.deleteAllMedia();

      logger.info('All media deleted', { 
        deleted: result.deleted,
        failed: result.failed,
        total: result.total 
      });

      const response: ApiResponse = {
        success: true,
        message: `${result.deleted} média(s) supprimé(s) avec succès${result.failed > 0 ? `, ${result.failed} échec(s)` : ''}`,
        data: {
          deleted: result.deleted,
          failed: result.failed,
          total: result.total,
          skipped: result.skipped,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Replace media across all references
   * PUT /api/admin/media/:id/replace
   */
  public async replaceMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { oldUrl, newUrl } = req.body;

      if (!oldUrl || !newUrl) {
        throw new ApiError('URLs ancien et nouveau requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      if (oldUrl === newUrl) {
        throw new ApiError('Les URLs doivent être différentes', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const result = await mediaLibraryService.replaceMedia(oldUrl, newUrl);

      logger.info('Media replaced', { oldUrl, newUrl, updated: result.updated });

      const response: ApiResponse = {
        success: true,
        message: `Média remplacé avec succès dans ${result.updated} référence(s)`,
        data: {
          updated: result.updated,
          references: result.references,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload new media to replace existing
   * POST /api/admin/media/upload-replace
   */
  public async uploadAndReplace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { oldUrl } = req.body;

      if (!oldUrl) {
        throw new ApiError('URL ancien requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      if (!req.file) {
        throw new ApiError('Fichier requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      let uploadResult;
      let newUrl: string;

      // Try UploadThing first
      if (uploadThingService.isConfigured()) {
        try {
          uploadResult = await uploadThingService.uploadBuffer(req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            folder: 'media-library',
            customId: `replace-${Date.now()}`,
          });
          newUrl = uploadResult.url;

          logger.info('Media uploaded to UploadThing for replacement', {
            oldUrl,
            newUrl,
            filename: req.file.originalname,
          });
        } catch (uploadThingError) {
          logger.warn('UploadThing upload failed, falling back to Cloudinary', { error: uploadThingError });
          // Fallback to Cloudinary
          uploadResult = await cloudinaryService.uploadBuffer(req.file.buffer, {
            folder: 'ebenor-creation/media-library',
            resource_type: 'auto',
          });
          newUrl = uploadResult.secure_url;
        }
      } else {
        // Use Cloudinary if UploadThing not configured
        uploadResult = await cloudinaryService.uploadBuffer(req.file.buffer, {
          folder: 'ebenor-creation/media-library',
          resource_type: 'auto',
        });
        newUrl = uploadResult.secure_url;
      }

      // Replace old URL with new URL across all references
      const result = await mediaLibraryService.replaceMedia(oldUrl, newUrl);

      logger.info('Media uploaded and replaced', {
        oldUrl,
        newUrl,
        updated: result.updated,
        filename: req.file.originalname,
      });

      const response: ApiResponse = {
        success: true,
        message: `Média téléchargé et remplacé avec succès dans ${result.updated} référence(s)`,
        data: {
          newUrl,
          updated: result.updated,
          references: result.references,
          uploadDetails: uploadThingService.isConfigured() 
            ? {
                key: (uploadResult as any).key,
                size: (uploadResult as any).size,
              }
            : {
                publicId: (uploadResult as any).public_id,
                format: (uploadResult as any).format,
                width: (uploadResult as any).width,
                height: (uploadResult as any).height,
                bytes: (uploadResult as any).bytes,
              },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search media by filename or tags
   * GET /api/admin/media/search
   */
  public async searchMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        throw new ApiError('Terme de recherche requis (minimum 2 caractères)', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        search: q.trim(),
      };

      const { media, total } = await mediaLibraryService.getAllMedia(page, limit, filters);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof media[0]> = {
        success: true,
        data: media,
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
   * Get storage usage information
   * GET /api/admin/media/storage
   */
  public async getStorageUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await mediaLibraryService.getMediaStats();

      // Convert bytes to MB
      const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

      const response: ApiResponse = {
        success: true,
        data: {
          totalSize: stats.totalSize,
          totalSizeMB: parseFloat(totalSizeMB),
          totalMedia: stats.totalMedia,
          totalImages: stats.totalImages,
          totalVideos: stats.totalVideos,
          bySource: stats.bySource,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get media by category
   * GET /api/admin/media/by-category/:category
   */
  public async getMediaByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        category,
      };

      const { media, total } = await mediaLibraryService.getAllMedia(page, limit, filters);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof media[0]> = {
        success: true,
        data: media,
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
   * Get media by source
   * GET /api/admin/media/by-source/:source
   */
  public async getMediaBySource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { source } = req.params;

      if (!['product', 'gallery', 'homepage'].includes(source)) {
        throw new ApiError('Source invalide', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        source: source as 'product' | 'gallery' | 'homepage',
      };

      const { media, total } = await mediaLibraryService.getAllMedia(page, limit, filters);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof media[0]> = {
        success: true,
        data: media,
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
}

// Export singleton instance
export const mediaLibraryController = new MediaLibraryController();
