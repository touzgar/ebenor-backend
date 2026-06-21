import { logger } from '../utils/logger';

/**
 * UploadThing Service
 * Handles image and video uploads to UploadThing
 */

interface UploadThingConfig {
  token: string;
  appId: string;
  secret: string;
}

interface UploadResult {
  url: string;
  key: string;
  name: string;
  size: number;
  type: string;
  customId?: string;
}

class UploadThingService {
  private config: UploadThingConfig;
  private apiUrl = 'https://api.uploadthing.com/v6';

  constructor() {
    this.config = {
      token: process.env.UPLOADTHING_TOKEN || '',
      appId: process.env.UPLOADTHING_APP_ID || '',
      secret: process.env.UPLOADTHING_SECRET || '',
    };

    if (!this.config.secret) {
      logger.warn('UploadThing credentials not configured');
    }
  }

  /**
   * Upload a file buffer to UploadThing
   */
  async uploadBuffer(
    buffer: Buffer,
    options: {
      filename: string;
      contentType: string;
      folder?: string;
      customId?: string;
    }
  ): Promise<UploadResult> {
    try {
      const { filename, contentType, customId } = options;

      // Use UploadThing's simpler upload endpoint
      const response = await fetch(`https://uploadthing.com/api/uploadFiles`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'x-uploadthing-api-key': this.config.secret,
          'x-uploadthing-version': '6.0.0',
          'x-uploadthing-fe-package': 'node',
          'x-uploadthing-be-adapter': 'express',
        },
        body: buffer,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`UploadThing upload failed: ${error}`);
      }

      const data = await response.json();
      const uploadedFile = (data as any).data?.[0] || data;

      if (!uploadedFile || !uploadedFile.url) {
        throw new Error('No file returned from UploadThing');
      }

      logger.info('File uploaded to UploadThing', {
        filename,
        size: buffer.length,
        url: uploadedFile.url,
      });

      return {
        url: uploadedFile.url,
        key: uploadedFile.key || uploadedFile.fileKey || filename,
        name: uploadedFile.name || filename,
        size: uploadedFile.size || buffer.length,
        type: contentType,
        customId,
      };
    } catch (error) {
      logger.error('Error uploading to UploadThing', { error });
      throw error;
    }
  }

  /**
   * Upload from URL
   */
  async uploadFromUrl(
    url: string,
    options: {
      filename?: string;
      folder?: string;
      customId?: string;
    } = {}
  ): Promise<UploadResult> {
    try {
      // Fetch the file from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from URL: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const filename = options.filename || url.split('/').pop() || 'uploaded-file';

      return await this.uploadBuffer(buffer, {
        filename,
        contentType,
        folder: options.folder,
        customId: options.customId,
      });
    } catch (error) {
      logger.error('Error uploading from URL to UploadThing', { error, url });
      throw error;
    }
  }

  /**
   * Delete a file from UploadThing
   */
  async deleteFile(fileKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/deleteFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-uploadthing-api-key': this.config.secret,
        },
        body: JSON.stringify({ fileKey }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Failed to delete file from UploadThing', { error, fileKey });
        return false;
      }

      logger.info('File deleted from UploadThing', { fileKey });
      return true;
    } catch (error) {
      logger.error('Error deleting file from UploadThing', { error, fileKey });
      return false;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(fileKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/getFile?fileKey=${fileKey}`, {
        method: 'GET',
        headers: {
          'x-uploadthing-api-key': this.config.secret,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get file info');
      }

      return await response.json();
    } catch (error) {
      logger.error('Error getting file info from UploadThing', { error, fileKey });
      throw error;
    }
  }

  /**
   * Extract file key from UploadThing URL
   */
  extractFileKey(url: string): string | null {
    try {
      // UploadThing URLs format: https://utfs.io/f/{fileKey}
      const match = url.match(/\/f\/([^/?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.config.secret && this.config.appId);
  }
}

// Export singleton instance
export const uploadThingService = new UploadThingService();
