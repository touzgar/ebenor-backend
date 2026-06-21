import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/security';
import { fileUploadService } from '../../services/fileUploadService';
import { ApiError, ERROR_CODES } from '../../middleware/errorHandler';
import { ApiResponse } from '../../types';
import { logger } from '../../utils/logger';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
});

// Configure multer for video uploads with larger size limit
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for videos
  },
  fileFilter: (req, file, cb) => {
    // Accept only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new ApiError('Seulement les fichiers vidéo sont acceptés', 400, ERROR_CODES.VALIDATION_ERROR) as any);
    }
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * Upload a single image
 * POST /api/admin/upload/image
 */
router.post(
  '/image',
  uploadLimiter,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;

      if (!file) {
        throw new ApiError(
          'Aucun fichier fourni',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Upload to cloud storage (UploadThing or Cloudinary)
      const folder = req.body.folder || 'homepage';
      const result = await fileUploadService.uploadImage(file, folder);

      logger.info('Image uploaded successfully', {
        public_id: result.public_id,
        folder,
        user: req.user?.email,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          size: result.bytes,
        },
        message: 'Image uploadée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload multiple images
 * POST /api/admin/upload/images
 */
router.post(
  '/images',
  uploadLimiter,
  upload.array('images', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new ApiError(
          'Aucun fichier fourni',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Upload all images
      const folder = req.body.folder || 'homepage';
      const results = await fileUploadService.uploadImages(files, folder);

      logger.info('Multiple images uploaded successfully', {
        count: results.length,
        folder,
        user: req.user?.email,
      });

      const response: ApiResponse = {
        success: true,
        data: results.map((result) => ({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          size: result.bytes,
        })),
        message: `${results.length} image(s) uploadée(s) avec succès`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete an image
 * DELETE /api/admin/upload/image/:publicId
 */
router.delete(
  '/image/:publicId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;

      if (!publicId) {
        throw new ApiError(
          'Public ID requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Decode the public ID (it may be URL encoded)
      const decodedPublicId = decodeURIComponent(publicId);

      await fileUploadService.deleteFile(decodedPublicId, 'image');

      logger.info('Image deleted successfully', {
        public_id: decodedPublicId,
        user: req.user?.email,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Image supprimée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload a single video
 * POST /api/admin/upload/video
 */
router.post(
  '/video',
  uploadLimiter,
  videoUpload.single('video'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;

      if (!file) {
        throw new ApiError(
          'Aucun fichier vidéo fourni',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Upload to cloud storage (UploadThing or Cloudinary)
      const folder = req.body.folder || 'videos';
      const result = await fileUploadService.uploadVideo(file, folder);

      logger.info('Video uploaded successfully', {
        public_id: result.public_id,
        folder,
        user: req.user?.email,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          url: result.secure_url || result.url,
          publicId: result.public_id,
          format: result.format,
          duration: result.duration,
          size: result.bytes,
        },
        message: 'Vidéo uploadée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a video
 * DELETE /api/admin/upload/video/:publicId
 */
router.delete(
  '/video/:publicId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { publicId } = req.params;

      if (!publicId) {
        throw new ApiError(
          'Public ID requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Decode the public ID (it may be URL encoded)
      const decodedPublicId = decodeURIComponent(publicId);

      await fileUploadService.deleteFile(decodedPublicId, 'video');

      logger.info('Video deleted successfully', {
        public_id: decodedPublicId,
        user: req.user?.email,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Vidéo supprimée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
