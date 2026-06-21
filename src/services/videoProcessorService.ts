import { cloudinaryService } from './cloudinaryService';
import { logger } from '../utils/logger';

export interface VideoProcessingResult {
  publicId: string;
  url: string;
  secureUrl: string;
  thumbnailUrl: string;
  format: string;
  duration: number;
  width: number;
  height: number;
  size: number;
}

export class VideoProcessorService {
  // Allowed video formats
  private readonly ALLOWED_FORMATS = ['mp4', 'webm'];
  
  // Maximum video size (100MB)
  private readonly MAX_SIZE = 100 * 1024 * 1024;

  /**
   * Validate video format
   */
  public validateFormat(format: string): { isValid: boolean; error?: string } {
    const normalizedFormat = format.toLowerCase().replace('video/', '');
    
    if (!this.ALLOWED_FORMATS.includes(normalizedFormat)) {
      return {
        isValid: false,
        error: `Format vidéo non autorisé. Formats acceptés: ${this.ALLOWED_FORMATS.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate video size
   */
  public validateSize(size: number): { isValid: boolean; error?: string } {
    if (size > this.MAX_SIZE) {
      const maxSizeMB = (this.MAX_SIZE / (1024 * 1024)).toFixed(0);
      return {
        isValid: false,
        error: `Taille de vidéo trop grande. Taille maximale: ${maxSizeMB}MB`,
      };
    }

    return { isValid: true };
  }

  /**
   * Process uploaded video
   */
  public async processVideo(
    buffer: Buffer,
    folder: string = 'products',
    filename?: string,
    mimetype?: string
  ): Promise<VideoProcessingResult> {
    try {
      // Validate format if provided
      if (mimetype) {
        const formatValidation = this.validateFormat(mimetype);
        if (!formatValidation.isValid) {
          throw new Error(formatValidation.error);
        }
      }

      // Validate size
      const sizeValidation = this.validateSize(buffer.length);
      if (!sizeValidation.isValid) {
        throw new Error(sizeValidation.error);
      }

      // Upload video to Cloudinary
      const uploadResult = await cloudinaryService.uploadBuffer(buffer, {
        folder: `ebenor-creation/${folder}`,
        resource_type: 'video',
        public_id: filename,
        tags: [folder, 'video'],
      });

      // Generate thumbnail from video
      const thumbnailUrl = this.generateThumbnail(uploadResult.public_id);

      // Get video details
      const details = await cloudinaryService.getFileDetails(uploadResult.public_id, 'video');

      logger.info('Video processed successfully', {
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        duration: details.duration,
      });

      return {
        publicId: uploadResult.public_id,
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
        thumbnailUrl,
        format: uploadResult.format,
        duration: details.duration || 0,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.bytes,
      };
    } catch (error) {
      logger.error('Error processing video', { error });
      throw new Error(`Video processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate thumbnail from video
   */
  public generateThumbnail(publicId: string, time: number = 0): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        start_offset: time,
        width: 640,
        height: 360,
        crop: 'fill',
        gravity: 'auto',
      },
      {
        quality: 'auto:good',
        fetch_format: 'jpg',
      },
    ]);
  }

  /**
   * Generate multiple thumbnails at different timestamps
   */
  public generateThumbnails(publicId: string, timestamps: number[] = [0, 5, 10]): string[] {
    return timestamps.map((time) => this.generateThumbnail(publicId, time));
  }

  /**
   * Get video streaming URL
   */
  public getStreamingUrl(publicId: string, quality: 'auto' | 'low' | 'medium' | 'high' = 'auto'): string {
    const qualityMap = {
      auto: 'auto',
      low: 'auto:low',
      medium: 'auto:good',
      high: 'auto:best',
    };

    return cloudinaryService.getTransformationUrl(publicId, [
      {
        quality: qualityMap[quality],
        fetch_format: 'auto',
      },
    ]);
  }

  /**
   * Get video with specific dimensions
   */
  public getResizedVideoUrl(publicId: string, width: number, height: number): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        width,
        height,
        crop: 'limit',
      },
      {
        quality: 'auto:good',
        fetch_format: 'auto',
      },
    ]);
  }

  /**
   * Get video details
   */
  public async getVideoDetails(publicId: string): Promise<any> {
    try {
      const details = await cloudinaryService.getFileDetails(publicId, 'video');
      return {
        publicId: details.public_id,
        format: details.format,
        duration: details.duration,
        width: details.width,
        height: details.height,
        size: details.bytes,
        createdAt: details.created_at,
        url: details.secure_url,
      };
    } catch (error) {
      logger.error('Error getting video details', { error, public_id: publicId });
      throw new Error(`Failed to get video details: ${(error as Error).message}`);
    }
  }

  /**
   * Delete video from Cloudinary
   */
  public async deleteVideo(publicId: string): Promise<void> {
    try {
      await cloudinaryService.deleteFile(publicId, 'video');
      logger.info('Video deleted successfully', { public_id: publicId });
    } catch (error) {
      logger.error('Error deleting video', { error, public_id: publicId });
      throw new Error(`Failed to delete video: ${(error as Error).message}`);
    }
  }

  /**
   * Generate video player embed code
   */
  public generateEmbedCode(publicId: string, width: number = 640, height: number = 360): string {
    const url = this.getStreamingUrl(publicId);
    return `<video width="${width}" height="${height}" controls>
  <source src="${url}" type="video/mp4">
  Votre navigateur ne supporte pas la lecture de vidéos.
</video>`;
  }

  /**
   * Get video aspect ratio
   */
  public calculateAspectRatio(width: number, height: number): number {
    return width / height;
  }

  /**
   * Check if video is in landscape or portrait orientation
   */
  public getOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
    if (width > height) {
      return 'landscape';
    } else if (height > width) {
      return 'portrait';
    } else {
      return 'square';
    }
  }

  /**
   * Format video duration (seconds to HH:MM:SS)
   */
  public formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
    parts.push(minutes.toString().padStart(2, '0'));
    parts.push(secs.toString().padStart(2, '0'));

    return parts.join(':');
  }

  /**
   * Get video file size in human-readable format
   */
  public formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Export singleton instance
export const videoProcessorService = new VideoProcessorService();
