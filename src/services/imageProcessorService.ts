import { cloudinaryService } from './cloudinaryService';
import { logger } from '../utils/logger';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProcessedImageUrls {
  thumbnail: string;
  medium: string;
  large: string;
  original: string;
  webp: {
    thumbnail: string;
    medium: string;
    large: string;
    original: string;
  };
  jpeg: {
    thumbnail: string;
    medium: string;
    large: string;
    original: string;
  };
}

export interface ImageProcessingResult {
  publicId: string;
  urls: ProcessedImageUrls;
  dimensions: ImageDimensions;
  format: string;
  size: number;
}

export class ImageProcessorService {
  // Image size configurations
  private readonly THUMBNAIL_SIZE = 300;
  private readonly MEDIUM_SIZE = 800;
  private readonly LARGE_SIZE = 1920;

  /**
   * Process uploaded image and generate all required versions
   */
  public async processImage(
    buffer: Buffer,
    folder: string = 'products',
    filename?: string
  ): Promise<ImageProcessingResult> {
    try {
      // Upload original image to Cloudinary
      const uploadResult = await cloudinaryService.uploadBuffer(buffer, {
        folder: `ebenor-creation/${folder}`,
        resource_type: 'image',
        public_id: filename,
        tags: [folder, 'processed'],
      });

      // Extract dimensions
      const dimensions: ImageDimensions = {
        width: uploadResult.width,
        height: uploadResult.height,
      };

      // Generate all URL versions
      const urls = this.generateImageUrls(uploadResult.public_id);

      logger.info('Image processed successfully', {
        public_id: uploadResult.public_id,
        dimensions,
        format: uploadResult.format,
      });

      return {
        publicId: uploadResult.public_id,
        urls,
        dimensions,
        format: uploadResult.format,
        size: uploadResult.bytes,
      };
    } catch (error) {
      logger.error('Error processing image', { error });
      throw new Error(`Image processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate all image URL versions (thumbnail, medium, large, original)
   * with WebP and JPEG formats
   */
  public generateImageUrls(publicId: string): ProcessedImageUrls {
    return {
      // Default format (auto)
      thumbnail: this.getThumbnailUrl(publicId),
      medium: this.getMediumUrl(publicId),
      large: this.getLargeUrl(publicId),
      original: this.getOriginalUrl(publicId),

      // WebP format
      webp: {
        thumbnail: this.getThumbnailUrl(publicId, 'webp'),
        medium: this.getMediumUrl(publicId, 'webp'),
        large: this.getLargeUrl(publicId, 'webp'),
        original: this.getOriginalUrl(publicId, 'webp'),
      },

      // JPEG format (fallback)
      jpeg: {
        thumbnail: this.getThumbnailUrl(publicId, 'jpg'),
        medium: this.getMediumUrl(publicId, 'jpg'),
        large: this.getLargeUrl(publicId, 'jpg'),
        original: this.getOriginalUrl(publicId, 'jpg'),
      },
    };
  }

  /**
   * Generate thumbnail URL (300x300 max, maintains aspect ratio)
   */
  private getThumbnailUrl(publicId: string, format: string = 'auto'): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        width: this.THUMBNAIL_SIZE,
        height: this.THUMBNAIL_SIZE,
        crop: 'limit',
        gravity: 'auto',
      },
      {
        quality: 'auto:good',
        fetch_format: format,
      },
    ]);
  }

  /**
   * Generate medium URL (800x800 max, maintains aspect ratio)
   */
  private getMediumUrl(publicId: string, format: string = 'auto'): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        width: this.MEDIUM_SIZE,
        height: this.MEDIUM_SIZE,
        crop: 'limit',
      },
      {
        quality: 'auto:good',
        fetch_format: format,
      },
    ]);
  }

  /**
   * Generate large URL (1920x1920 max, maintains aspect ratio)
   */
  private getLargeUrl(publicId: string, format: string = 'auto'): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        width: this.LARGE_SIZE,
        height: this.LARGE_SIZE,
        crop: 'limit',
      },
      {
        quality: 'auto:good',
        fetch_format: format,
      },
    ]);
  }

  /**
   * Generate original URL (optimized quality)
   */
  private getOriginalUrl(publicId: string, format: string = 'auto'): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        quality: 'auto:best',
        fetch_format: format,
      },
    ]);
  }

  /**
   * Extract image dimensions from buffer (using Cloudinary)
   */
  public async extractDimensions(publicId: string): Promise<ImageDimensions> {
    try {
      const details = await cloudinaryService.getFileDetails(publicId, 'image');
      return {
        width: details.width,
        height: details.height,
      };
    } catch (error) {
      logger.error('Error extracting image dimensions', { error, public_id: publicId });
      throw new Error(`Failed to extract dimensions: ${(error as Error).message}`);
    }
  }

  /**
   * Compress image with quality optimization
   */
  public getCompressedUrl(publicId: string, quality: number = 80): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      {
        quality: `auto:${quality}`,
        fetch_format: 'auto',
      },
    ]);
  }

  /**
   * Generate responsive srcset for HTML img tag
   */
  public generateSrcSet(publicId: string): string {
    const widths = [320, 640, 768, 1024, 1280, 1536, 1920];
    const srcset = widths.map((width) => {
      const url = cloudinaryService.getTransformationUrl(publicId, [
        { width, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ]);
      return `${url} ${width}w`;
    });

    return srcset.join(', ');
  }

  /**
   * Generate blur placeholder for lazy loading
   */
  public getBlurPlaceholder(publicId: string): string {
    return cloudinaryService.getTransformationUrl(publicId, [
      { width: 20, height: 20, crop: 'fill', gravity: 'auto' },
      { quality: 'auto:low', fetch_format: 'auto', effect: 'blur:1000' },
    ]);
  }

  /**
   * Check if image maintains aspect ratio
   */
  public maintainsAspectRatio(
    originalDimensions: ImageDimensions,
    processedDimensions: ImageDimensions,
    tolerance: number = 0.01
  ): boolean {
    const originalRatio = originalDimensions.width / originalDimensions.height;
    const processedRatio = processedDimensions.width / processedDimensions.height;
    const difference = Math.abs(originalRatio - processedRatio);

    return difference <= tolerance;
  }

  /**
   * Get image orientation
   */
  public getOrientation(dimensions: ImageDimensions): 'landscape' | 'portrait' | 'square' {
    if (dimensions.width > dimensions.height) {
      return 'landscape';
    } else if (dimensions.height > dimensions.width) {
      return 'portrait';
    } else {
      return 'square';
    }
  }

  /**
   * Calculate aspect ratio
   */
  public calculateAspectRatio(dimensions: ImageDimensions): number {
    return dimensions.width / dimensions.height;
  }
}

// Export singleton instance
export const imageProcessorService = new ImageProcessorService();
