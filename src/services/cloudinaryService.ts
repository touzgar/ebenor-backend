import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { logger } from '../utils/logger';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadOptions {
  folder?: string;
  transformation?: any[];
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
  public_id?: string;
  overwrite?: boolean;
  tags?: string[];
}

export interface CloudinaryUploadResult {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resource_type: string;
  created_at: string;
}

export class CloudinaryService {
  /**
   * Upload a file to Cloudinary
   */
  public async uploadFile(
    filePath: string,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    try {
      const defaultOptions = {
        folder: options.folder || 'ebenor-creation',
        resource_type: options.resource_type || 'auto',
        overwrite: options.overwrite !== undefined ? options.overwrite : false,
        tags: options.tags || [],
      };

      const result: UploadApiResponse = await cloudinary.uploader.upload(filePath, {
        ...defaultOptions,
        ...options,
      });

      logger.info('File uploaded to Cloudinary', {
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
      });

      return {
        public_id: result.public_id,
        url: result.url,
        secure_url: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resource_type: result.resource_type,
        created_at: result.created_at,
      };
    } catch (error) {
      logger.error('Error uploading file to Cloudinary', { error });
      throw new Error(`Cloudinary upload failed: ${(error as Error).message}`);
    }
  }

  /**
   * Upload a file from buffer
   */
  public async uploadBuffer(
    buffer: Buffer,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'ebenor-creation',
          resource_type: options.resource_type || 'auto',
          overwrite: options.overwrite !== undefined ? options.overwrite : false,
          tags: options.tags || [],
          ...options,
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error) {
            logger.error('Error uploading buffer to Cloudinary', { error });
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (result) {
            logger.info('Buffer uploaded to Cloudinary', {
              public_id: result.public_id,
              format: result.format,
              bytes: result.bytes,
            });

            resolve({
              public_id: result.public_id,
              url: result.url,
              secure_url: result.secure_url,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              resource_type: result.resource_type,
              created_at: result.created_at,
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  public async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.info('File deleted from Cloudinary', { public_id: publicId });
    } catch (error) {
      logger.error('Error deleting file from Cloudinary', { error, public_id: publicId });
      throw new Error(`Cloudinary delete failed: ${(error as Error).message}`);
    }
  }

  /**
   * Delete multiple files from Cloudinary
   */
  public async deleteFiles(publicIds: string[], resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.api.delete_resources(publicIds, { resource_type: resourceType });
      logger.info('Multiple files deleted from Cloudinary', { count: publicIds.length });
    } catch (error) {
      logger.error('Error deleting multiple files from Cloudinary', { error });
      throw new Error(`Cloudinary bulk delete failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate transformation URL for an image
   */
  public getTransformationUrl(
    publicId: string,
    transformations: any[]
  ): string {
    return cloudinary.url(publicId, {
      transformation: transformations,
      secure: true,
    });
  }

  /**
   * Generate thumbnail URL
   */
  public getThumbnailUrl(publicId: string, width: number = 300, height: number = 300, resourceType: 'image' | 'video' = 'image'): string {
    return cloudinary.url(publicId, {
      resource_type: resourceType,
      transformation: [
        { width, height, crop: 'fill', gravity: 'auto' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
      secure: true,
    });
  }

  /**
   * Generate responsive image URLs
   */
  public getResponsiveUrls(publicId: string): {
    thumbnail: string;
    medium: string;
    large: string;
    original: string;
  } {
    return {
      thumbnail: this.getThumbnailUrl(publicId, 300, 300),
      medium: cloudinary.url(publicId, {
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
        secure: true,
      }),
      large: cloudinary.url(publicId, {
        transformation: [
          { width: 1920, height: 1920, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
        secure: true,
      }),
      original: cloudinary.url(publicId, {
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        secure: true,
      }),
    };
  }

  /**
   * Generate signed upload URL for client-side uploads
   */
  public generateSignedUploadUrl(folder: string = 'ebenor-creation'): {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
    folder: string;
  } {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET as string
    );

    return {
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY as string,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
      folder,
    };
  }

  /**
   * Get file details from Cloudinary
   */
  public async getFileDetails(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, { resource_type: resourceType });
      return result;
    } catch (error) {
      logger.error('Error getting file details from Cloudinary', { error, public_id: publicId });
      throw new Error(`Cloudinary get details failed: ${(error as Error).message}`);
    }
  }

  /**
   * Search files in Cloudinary
   */
  public async searchFiles(expression: string, maxResults: number = 30): Promise<any> {
    try {
      const result = await cloudinary.search
        .expression(expression)
        .max_results(maxResults)
        .execute();
      return result;
    } catch (error) {
      logger.error('Error searching files in Cloudinary', { error });
      throw new Error(`Cloudinary search failed: ${(error as Error).message}`);
    }
  }
}

// Export singleton instance
export const cloudinaryService = new CloudinaryService();
