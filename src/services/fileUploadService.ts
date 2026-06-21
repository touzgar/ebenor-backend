import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { uploadThingService } from './uploadThingService';
import { cloudinaryService, CloudinaryUploadOptions } from './cloudinaryService';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export class FileUploadService {
  /**
   * Validate file type
   */
  public validateFileType(mimetype: string, allowedTypes: string[]): FileValidationResult {
    if (!allowedTypes.includes(mimetype)) {
      return {
        isValid: false,
        error: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}`,
      };
    }
    return { isValid: true };
  }

  /**
   * Validate file size
   */
  public validateFileSize(size: number, maxSize: number): FileValidationResult {
    if (size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        error: `Taille de fichier trop grande. Taille maximale: ${maxSizeMB}MB`,
      };
    }
    return { isValid: true };
  }

  /**
   * Validate image file
   */
  public validateImage(file: Express.Multer.File): FileValidationResult {
    // Validate type
    const typeValidation = this.validateFileType(file.mimetype, ALLOWED_IMAGE_TYPES);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // Validate size
    const sizeValidation = this.validateFileSize(file.size, MAX_IMAGE_SIZE);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }

    return { isValid: true };
  }

  /**
   * Validate video file
   */
  public validateVideo(file: Express.Multer.File): FileValidationResult {
    // Validate type
    const typeValidation = this.validateFileType(file.mimetype, ALLOWED_VIDEO_TYPES);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    // Validate size
    const sizeValidation = this.validateFileSize(file.size, MAX_VIDEO_SIZE);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }

    return { isValid: true };
  }

  /**
   * Upload image to UploadThing (or Cloudinary as fallback)
   */
  public async uploadImage(
    file: Express.Multer.File,
    folder: string = 'products'
  ): Promise<any> {
    try {
      // Validate image
      const validation = this.validateImage(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // If neither UploadThing nor Cloudinary are configured, fail fast with a clear error
      const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME);
      if (!uploadThingService.isConfigured() && !cloudinaryConfigured) {
        throw new ApiError(
          'Aucune solution de stockage de fichiers n\'est configurée sur le serveur. Veuillez définir les variables d\'environnement CLOUDINARY_* ou UPLOADTHING_*',
          500,
          ERROR_CODES.UPLOAD_FAILED
        );
      }

      // Try UploadThing first
      if (uploadThingService.isConfigured()) {
        try {
          const result = await uploadThingService.uploadBuffer(file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
            folder,
            customId: `${folder}-${Date.now()}`,
          });

          logger.info('Image uploaded to UploadThing successfully', {
            key: result.key,
            folder,
            url: result.url,
          });

          // Return in Cloudinary-compatible format for backward compatibility
          return {
            secure_url: result.url,
            public_id: result.key,
            url: result.url,
            format: file.mimetype.split('/')[1],
            width: null,
            height: null,
            bytes: result.size,
            resource_type: 'image',
          };
        } catch (uploadThingError: any) {
          logger.warn('UploadThing upload failed, attempting Cloudinary fallback', { 
            error: uploadThingError?.message || uploadThingError,
            folder,
          });
        }
      } else if (!cloudinaryConfigured) {
        // UploadThing not configured and Cloudinary also not configured (should have been caught above), but log defensively
        logger.debug('UploadThing not configured and Cloudinary not available');
      } else {
        logger.debug('UploadThing not configured (missing UPLOADTHING_SECRET or UPLOADTHING_APP_ID), using Cloudinary');
      }

      // Fallback to Cloudinary
      const options: CloudinaryUploadOptions = {
        folder: `ebenor-creation/${folder}`,
        resource_type: 'image',
        tags: [folder],
      };

      try {
        const result = await cloudinaryService.uploadBuffer(file.buffer, options);

        logger.info('Image uploaded to Cloudinary successfully', {
          public_id: result.public_id,
          folder,
        });

        return result;
      } catch (cloudinaryError: any) {
        logger.error('Cloudinary upload failed', { 
          error: cloudinaryError?.message || cloudinaryError,
          folder,
          filename: file.originalname,
        });
        throw new Error(`Image upload failed: ${cloudinaryError?.message || 'Both UploadThing and Cloudinary failed'}`);
      }
    } catch (error) {
      logger.error('Error uploading image', { error });
      throw error;
    }
  }

  /**
   * Upload multiple images to Cloudinary
   */
  public async uploadImages(
    files: Express.Multer.File[],
    folder: string = 'products'
  ): Promise<any[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadImage(file, folder));
      const results = await Promise.all(uploadPromises);

      logger.info('Multiple images uploaded successfully', {
        count: results.length,
        folder,
      });

      return results;
    } catch (error) {
      logger.error('Error uploading multiple images', { error });
      throw error;
    }
  }

  /**
   * Upload video to UploadThing (or Cloudinary as fallback)
   */
  public async uploadVideo(
    file: Express.Multer.File,
    folder: string = 'products'
  ): Promise<any> {
    try {
      // Validate video
      const validation = this.validateVideo(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
      // If neither UploadThing nor Cloudinary are configured, fail fast with a clear error
      const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME);
      if (!uploadThingService.isConfigured() && !cloudinaryConfigured) {
        throw new ApiError(
          'Aucune solution de stockage de fichiers n\'est configurée sur le serveur. Veuillez définir les variables d\'environnement CLOUDINARY_* ou UPLOADTHING_*',
          500,
          ERROR_CODES.UPLOAD_FAILED
        );
      }

      // Try UploadThing first
      if (uploadThingService.isConfigured()) {
        try {
          const result = await uploadThingService.uploadBuffer(file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
            folder,
            customId: `${folder}-video-${Date.now()}`,
          });

          logger.info('Video uploaded to UploadThing successfully', {
            key: result.key,
            folder,
            url: result.url,
          });

          // Return in Cloudinary-compatible format
          return {
            secure_url: result.url,
            public_id: result.key,
            url: result.url,
            format: file.mimetype.split('/')[1],
            bytes: result.size,
            resource_type: 'video',
          };
        } catch (uploadThingError: any) {
          logger.warn('UploadThing video upload failed, attempting Cloudinary fallback', { 
            error: uploadThingError?.message || uploadThingError,
            folder,
          });
        }
      } else {
        logger.debug('UploadThing not configured for video, using Cloudinary');
      }

      // Fallback to Cloudinary
      const options: CloudinaryUploadOptions = {
        folder: `ebenor-creation/${folder}`,
        resource_type: 'video',
        tags: [folder],
      };

      try {
        const result = await cloudinaryService.uploadBuffer(file.buffer, options);

        logger.info('Video uploaded to Cloudinary successfully', {
          public_id: result.public_id,
          folder,
        });

        return result;
      } catch (cloudinaryError: any) {
        logger.error('Cloudinary video upload failed', { 
          error: cloudinaryError?.message || cloudinaryError,
          folder,
          filename: file.originalname,
        });
        throw new Error(`Video upload failed: ${cloudinaryError?.message || 'Both UploadThing and Cloudinary failed'}`);
      }
    } catch (error) {
      logger.error('Error uploading video', { error });
      throw error;
    }
  }

  /**
   * Delete file from UploadThing or Cloudinary
   */
  public async deleteFile(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    try {
      // Check if it's an UploadThing URL/key
      const isUploadThingUrl = publicId.includes('utfs.io') || publicId.includes('uploadthing');
      
      if (isUploadThingUrl && uploadThingService.isConfigured()) {
        const fileKey = uploadThingService.extractFileKey(publicId) || publicId;
        await uploadThingService.deleteFile(fileKey);
        logger.info('File deleted from UploadThing successfully', { key: fileKey });
      } else {
        // Delete from Cloudinary
        await cloudinaryService.deleteFile(publicId, resourceType);
        logger.info('File deleted from Cloudinary successfully', { public_id: publicId });
      }
    } catch (error) {
      logger.error('Error deleting file', { error, public_id: publicId });
      throw error;
    }
  }

  /**
   * Delete multiple files from Cloudinary
   */
  public async deleteFiles(publicIds: string[], resourceType: 'image' | 'video' = 'image'): Promise<void> {
    try {
      await cloudinaryService.deleteFiles(publicIds, resourceType);
      logger.info('Multiple files deleted successfully', { count: publicIds.length });
    } catch (error) {
      logger.error('Error deleting multiple files', { error });
      throw error;
    }
  }

  /**
   * Get responsive image URLs
   */
  public getResponsiveImageUrls(publicId: string): {
    thumbnail: string;
    medium: string;
    large: string;
    original: string;
  } {
    return cloudinaryService.getResponsiveUrls(publicId);
  }
}

// Multer configuration for memory storage
export const multerConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use max video size as the limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept all files here, validation will be done in the service
    cb(null, true);
  },
});

// Export singleton instance
export const fileUploadService = new FileUploadService();
