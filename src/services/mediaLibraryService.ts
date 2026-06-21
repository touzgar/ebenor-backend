import { Product } from '../models/Product';
import { GalleryImage } from '../models/GalleryImage';
import { HomeContent } from '../models/HomeContent';
import { cloudinaryService } from './cloudinaryService';
import { logger } from '../utils/logger';

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  type: 'image' | 'video';
  mimeType?: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
  category?: string;
  tags?: string[];
  uploadedAt: Date;
  source: 'product' | 'gallery' | 'homepage';
  sourceId: string;
  references: MediaReference[];
}

export interface MediaReference {
  type: 'product' | 'gallery' | 'homepage';
  id: string;
  name: string;
  field?: string;
}

export interface MediaLibraryFilters {
  type?: 'image' | 'video';
  category?: string;
  source?: 'product' | 'gallery' | 'homepage';
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface MediaLibraryStats {
  totalMedia: number;
  totalImages: number;
  totalVideos: number;
  totalSize: number;
  bySource: {
    product: number;
    gallery: number;
    homepage: number;
  };
  byCategory: Record<string, number>;
}

export class MediaLibraryService {
  /**
   * Get all media with pagination and filters
   */
  public async getAllMedia(
    page: number = 1,
    limit: number = 20,
    filters: MediaLibraryFilters = {}
  ): Promise<{ media: MediaItem[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const allMedia: MediaItem[] = [];

      // Fetch media from all sources
      const [productMedia, galleryMedia, homepageMedia] = await Promise.all([
        this.getProductMedia(filters),
        this.getGalleryMedia(filters),
        this.getHomepageMedia(filters),
      ]);

      allMedia.push(...productMedia, ...galleryMedia, ...homepageMedia);

      // Apply search filter if provided
      let filteredMedia = allMedia;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredMedia = allMedia.filter(
          (media) =>
            media.filename.toLowerCase().includes(searchLower) ||
            media.tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ||
            media.category?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by upload date (newest first)
      filteredMedia.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

      // Apply pagination
      const paginatedMedia = filteredMedia.slice(skip, skip + limit);

      return {
        media: paginatedMedia,
        total: filteredMedia.length,
      };
    } catch (error) {
      logger.error('Error fetching media library', { error });
      throw error;
    }
  }

  /**
   * Get media from products
   */
  private async getProductMedia(filters: MediaLibraryFilters): Promise<MediaItem[]> {
    if (filters.source && filters.source !== 'product') {
      return [];
    }

    const query: any = {};
    if (filters.category) {
      query.category = filters.category;
    }

    const products = await Product.find(query).lean();
    const mediaItems: MediaItem[] = [];

    for (const product of products) {
      // Process product images
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          const mediaItem: MediaItem = {
            id: `product-${product._id}-img-${image.url}`,
            url: image.url,
            thumbnailUrl: this.extractThumbnailUrl(image.url),
            filename: this.extractFilename(image.url),
            type: 'image',
            size: 0, // Size not stored in product images
            category: product.category,
            tags: product.tags,
            uploadedAt: product.createdAt || new Date(),
            source: 'product',
            sourceId: product._id!.toString(),
            references: [
              {
                type: 'product',
                id: product._id!.toString(),
                name: product.name,
                field: 'images',
              },
            ],
          };

          // Apply type filter
          if (!filters.type || filters.type === 'image') {
            mediaItems.push(mediaItem);
          }
        }
      }

      // Process product video
      if (product.video && product.video.url) {
        const mediaItem: MediaItem = {
          id: `product-${product._id}-video-${product.video.url}`,
          url: product.video.url,
          thumbnailUrl: product.video.thumbnail || this.extractThumbnailUrl(product.video.url),
          filename: this.extractFilename(product.video.url),
          type: 'video',
          size: 0, // Size not stored in product videos
          category: product.category,
          tags: product.tags,
          uploadedAt: product.createdAt || new Date(),
          source: 'product',
          sourceId: product._id!.toString(),
          references: [
            {
              type: 'product',
              id: product._id!.toString(),
              name: product.name,
              field: 'video',
            },
          ],
        };

        // Apply type filter
        if (!filters.type || filters.type === 'video') {
          mediaItems.push(mediaItem);
        }
      }
    }

    return mediaItems;
  }

  /**
   * Get media from gallery
   */
  private async getGalleryMedia(filters: MediaLibraryFilters): Promise<MediaItem[]> {
    if (filters.source && filters.source !== 'gallery') {
      return [];
    }

    const query: any = {};
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.dateFrom || filters.dateTo) {
      query.uploadedAt = {};
      if (filters.dateFrom) {
        query.uploadedAt.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.uploadedAt.$lte = filters.dateTo;
      }
    }

    const images = await GalleryImage.find(query).lean();
    const mediaItems: MediaItem[] = [];

    for (const image of images) {
      const mediaItem: MediaItem = {
        id: `gallery-${image._id}`,
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
        filename: this.extractFilename(image.url),
        type: 'image',
        mimeType: image.mimeType,
        size: image.fileSize,
        dimensions: image.dimensions,
        category: image.category,
        tags: image.tags,
        uploadedAt: image.uploadedAt || new Date(),
        source: 'gallery',
        sourceId: image._id!.toString(),
        references: [
          {
            type: 'gallery',
            id: image._id!.toString(),
            name: image.title,
          },
        ],
      };

      // Apply type filter
      if (!filters.type || filters.type === 'image') {
        mediaItems.push(mediaItem);
      }
    }

    return mediaItems;
  }

  /**
   * Get media from homepage content
   */
  private async getHomepageMedia(filters: MediaLibraryFilters): Promise<MediaItem[]> {
    if (filters.source && filters.source !== 'homepage') {
      return [];
    }

    // Only fetch if no category filter or if it's a homepage-related category
    if (filters.category) {
      return [];
    }

    const homeContent = await HomeContent.findOne().lean();
    if (!homeContent) {
      return [];
    }

    const mediaItems: MediaItem[] = [];
    const processedUrls = new Set<string>();

    // Helper to add media item
    const addMediaItem = (url: string, field: string, name: string) => {
      if (!url || processedUrls.has(url)) return;
      processedUrls.add(url);

      const mediaItem: MediaItem = {
        id: `homepage-${field}-${url}`,
        url,
        thumbnailUrl: this.extractThumbnailUrl(url),
        filename: this.extractFilename(url),
        type: this.detectMediaType(url),
        size: 0,
        uploadedAt: homeContent.updatedAt || new Date(),
        source: 'homepage',
        sourceId: homeContent._id!.toString(),
        references: [
          {
            type: 'homepage',
            id: homeContent._id!.toString(),
            name,
            field,
          },
        ],
      };

      // Apply type filter
      if (!filters.type || filters.type === mediaItem.type) {
        mediaItems.push(mediaItem);
      }
    };

    // Extract media from hero section
    if (homeContent.hero?.backgroundImage) {
      addMediaItem(homeContent.hero.backgroundImage, 'hero.backgroundImage', 'Hero Background');
    }

    // Extract media from about section
    if (homeContent.about?.image) {
      addMediaItem(homeContent.about.image, 'about.image', 'About Image');
    }

    // Extract media from services
    if (homeContent.services) {
      homeContent.services.forEach((service, index) => {
        if (service.image) {
          addMediaItem(service.image, `services[${index}].image`, service.title);
        }
      });
    }

    // Extract media from process
    if (homeContent.process) {
      homeContent.process.forEach((step, index) => {
        if (step.image) {
          addMediaItem(step.image, `process[${index}].image`, step.title);
        }
      });
    }

    // Extract media from testimonials
    if (homeContent.testimonials) {
      homeContent.testimonials.forEach((testimonial, index) => {
        if (testimonial.image) {
          addMediaItem(testimonial.image, `testimonials[${index}].image`, testimonial.name);
        }
      });
    }

    return mediaItems;
  }

  /**
   * Get media statistics
   */
  public async getMediaStats(): Promise<MediaLibraryStats> {
    try {
      const [productMedia, galleryMedia, homepageMedia] = await Promise.all([
        this.getProductMedia({}),
        this.getGalleryMedia({}),
        this.getHomepageMedia({}),
      ]);

      const allMedia = [...productMedia, ...galleryMedia, ...homepageMedia];

      const stats: MediaLibraryStats = {
        totalMedia: allMedia.length,
        totalImages: allMedia.filter((m) => m.type === 'image').length,
        totalVideos: allMedia.filter((m) => m.type === 'video').length,
        totalSize: allMedia.reduce((sum, m) => sum + m.size, 0),
        bySource: {
          product: productMedia.length,
          gallery: galleryMedia.length,
          homepage: homepageMedia.length,
        },
        byCategory: {},
      };

      // Count by category
      allMedia.forEach((media) => {
        if (media.category) {
          stats.byCategory[media.category] = (stats.byCategory[media.category] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error calculating media stats', { error });
      throw error;
    }
  }

  /**
   * Find media references across all sources
   */
  public async findMediaReferences(url: string): Promise<MediaReference[]> {
    try {
      const references: MediaReference[] = [];

      // Search in products for images
      const productsWithImages = await Product.find({
        'images.url': url,
      }).lean();

      productsWithImages.forEach((product) => {
        references.push({
          type: 'product',
          id: product._id!.toString(),
          name: product.name,
          field: 'images',
        });
      });

      // Search in products for videos
      const productsWithVideos = await Product.find({
        'video.url': url,
      }).lean();

      productsWithVideos.forEach((product) => {
        references.push({
          type: 'product',
          id: product._id!.toString(),
          name: product.name,
          field: 'video',
        });
      });

      // Search in gallery
      const galleryImages = await GalleryImage.find({ url }).lean();

      galleryImages.forEach((image) => {
        references.push({
          type: 'gallery',
          id: image._id!.toString(),
          name: image.title,
        });
      });

      // Search in homepage content
      const homeContent = await HomeContent.findOne().lean();
      if (homeContent) {
        const checkField = (fieldUrl: string, fieldName: string, displayName: string) => {
          if (fieldUrl === url) {
            references.push({
              type: 'homepage',
              id: homeContent._id!.toString(),
              name: displayName,
              field: fieldName,
            });
          }
        };

        // Check all homepage fields
        if (homeContent.hero?.backgroundImage) {
          checkField(homeContent.hero.backgroundImage, 'hero.backgroundImage', 'Hero Background');
        }
        if (homeContent.about?.image) {
          checkField(homeContent.about.image, 'about.image', 'About Image');
        }
        homeContent.services?.forEach((service, index) => {
          if (service.image) {
            checkField(service.image, `services[${index}].image`, service.title);
          }
        });
        homeContent.process?.forEach((step, index) => {
          if (step.image) {
            checkField(step.image, `process[${index}].image`, step.title);
          }
        });
        homeContent.testimonials?.forEach((testimonial, index) => {
          if (testimonial.image) {
            checkField(testimonial.image, `testimonials[${index}].image`, testimonial.name);
          }
        });
      }

      return references;
    } catch (error) {
      logger.error('Error finding media references', { error, url });
      throw error;
    }
  }

  /**
   * Delete media from database and cloud storage
   */
  public async deleteMedia(url: string): Promise<{ deleted: boolean; references: MediaReference[] }> {
    try {
      // Find all references first
      const references = await this.findMediaReferences(url);

      if (references.length > 0) {
        // Media is in use, return references without deleting
        return {
          deleted: false,
          references,
        };
      }

      // Delete from database collections
      // 1. Delete from GalleryImage
      const galleryResult = await GalleryImage.deleteMany({ url });
      if (galleryResult.deletedCount > 0) {
        logger.info('Deleted from GalleryImage collection', { url, count: galleryResult.deletedCount });
      }

      // 2. Delete from Products (remove image from images array)
      const productsWithImages = await Product.find({ 'images.url': url });
      for (const product of productsWithImages) {
        product.images = product.images.filter(img => img.url !== url);
        await product.save();
        logger.info('Removed image from Product', { productId: product._id, url });
      }

      // 3. Delete from Products (remove video)
      const productsWithVideos = await Product.find({ 'video.url': url });
      for (const product of productsWithVideos) {
        product.video = undefined;
        await product.save();
        logger.info('Removed video from Product', { productId: product._id, url });
      }

      // 4. Extract public ID from Cloudinary URL and delete from cloud
      const publicId = this.extractPublicId(url);
      if (publicId) {
        try {
          // Detect if it's a video or image
          const isVideo = this.detectMediaType(url) === 'video';
          await cloudinaryService.deleteFile(publicId, isVideo ? 'video' : 'image');
          logger.info(`Media deleted from Cloudinary (${isVideo ? 'video' : 'image'})`, { url, publicId });
        } catch (cloudError) {
          logger.warn('Failed to delete from Cloudinary (may not exist)', { url, error: cloudError });
        }
      }

      return {
        deleted: true,
        references: [],
      };
    } catch (error) {
      logger.error('Error deleting media', { error, url });
      throw error;
    }
  }

  /**
   * Delete all media from database and cloud storage
   */
  public async deleteAllMedia(): Promise<{ deleted: number; failed: number; total: number; skipped: number }> {
    try {
      let deletedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      let totalCount = 0;

      // Get all media
      const { media } = await this.getAllMedia(1, 10000, {}); // Get all media (with high limit)
      totalCount = media.length;

      logger.info(`Starting to delete ${totalCount} media items`);

      // Delete each media item
      for (const mediaItem of media) {
        try {
          // Check if media has references
          const references = await this.findMediaReferences(mediaItem.url);
          
          if (references.length > 0) {
            // Skip media that is in use
            skippedCount++;
            logger.info('Skipping media deletion (in use)', { 
              url: mediaItem.url, 
              references: references.length 
            });
            continue;
          }

          // Delete from database based on source
          if (mediaItem.source === 'gallery') {
            // Delete from GalleryImage collection
            const result = await GalleryImage.findByIdAndDelete(mediaItem.sourceId);
            if (result) {
              logger.info('Deleted GalleryImage from database', { 
                id: mediaItem.sourceId,
                url: mediaItem.url 
              });
            }
          } else if (mediaItem.source === 'product') {
            // Remove image from Product's images array
            const product = await Product.findById(mediaItem.sourceId);
            if (product) {
              product.images = product.images.filter(img => img.url !== mediaItem.url);
              await product.save();
              logger.info('Removed image from Product', { 
                productId: mediaItem.sourceId,
                url: mediaItem.url 
              });
            }
          }

          // Delete from Cloudinary
          const publicId = this.extractPublicId(mediaItem.url);
          if (publicId) {
            try {
              await cloudinaryService.deleteFile(publicId);
              logger.info('Media deleted from Cloudinary', { 
                url: mediaItem.url, 
                publicId 
              });
            } catch (deleteError) {
              logger.warn('Failed to delete from Cloudinary (may not exist)', { 
                error: deleteError, 
                url: mediaItem.url,
                publicId 
              });
            }
          }

          deletedCount++;
        } catch (error) {
          failedCount++;
          logger.error('Error processing media deletion', { 
            error, 
            url: mediaItem.url 
          });
        }
      }

      logger.info('Completed media deletion', { 
        total: totalCount,
        deleted: deletedCount,
        failed: failedCount,
        skipped: skippedCount 
      });

      return {
        deleted: deletedCount,
        failed: failedCount,
        total: totalCount,
        skipped: skippedCount,
      };
    } catch (error) {
      logger.error('Error deleting all media', { error });
      throw error;
    }
  }

  /**
   * Replace media URL across all references
   */
  public async replaceMedia(oldUrl: string, newUrl: string): Promise<{ updated: number; references: MediaReference[] }> {
    try {
      const references = await this.findMediaReferences(oldUrl);
      let updateCount = 0;

      // Update products with images
      const productImageRefs = references.filter((ref) => ref.type === 'product' && ref.field === 'images');
      for (const ref of productImageRefs) {
        const product = await Product.findById(ref.id);
        if (product) {
          product.images = product.images.map((img) => ({
            ...img,
            url: img.url === oldUrl ? newUrl : img.url,
          }));
          await product.save();
          updateCount++;
        }
      }

      // Update products with videos
      const productVideoRefs = references.filter((ref) => ref.type === 'product' && ref.field === 'video');
      for (const ref of productVideoRefs) {
        const product = await Product.findById(ref.id);
        if (product && product.video) {
          product.video.url = newUrl;
          await product.save();
          updateCount++;
        }
      }

      // Update gallery
      const galleryRefs = references.filter((ref) => ref.type === 'gallery');
      for (const ref of galleryRefs) {
        await GalleryImage.findByIdAndUpdate(ref.id, { url: newUrl });
        updateCount++;
      }

      // Update homepage content
      const homepageRefs = references.filter((ref) => ref.type === 'homepage');
      if (homepageRefs.length > 0) {
        const homeContent = await HomeContent.findOne();
        if (homeContent) {
          // Helper to replace URL in nested structure
          const replaceInObject = (obj: any): any => {
            if (typeof obj === 'string') {
              return obj === oldUrl ? newUrl : obj;
            }
            if (Array.isArray(obj)) {
              return obj.map(replaceInObject);
            }
            if (obj && typeof obj === 'object') {
              const newObj: any = {};
              for (const key in obj) {
                newObj[key] = replaceInObject(obj[key]);
              }
              return newObj;
            }
            return obj;
          };

          homeContent.hero = replaceInObject(homeContent.hero);
          homeContent.about = replaceInObject(homeContent.about);
          homeContent.services = replaceInObject(homeContent.services);
          homeContent.process = replaceInObject(homeContent.process);
          homeContent.testimonials = replaceInObject(homeContent.testimonials);

          await homeContent.save();
          updateCount++;
        }
      }

      // Delete old media from Cloudinary
      const oldPublicId = this.extractPublicId(oldUrl);
      if (oldPublicId) {
        try {
          const isVideo = this.detectMediaType(oldUrl) === 'video';
          await cloudinaryService.deleteFile(oldPublicId, isVideo ? 'video' : 'image');
          logger.info(`Old media deleted from Cloudinary (${isVideo ? 'video' : 'image'})`, { oldUrl, oldPublicId });
        } catch (error) {
          logger.warn('Failed to delete old media from Cloudinary', { error, oldUrl });
        }
      }

      logger.info('Media replaced across references', { oldUrl, newUrl, updateCount });

      return {
        updated: updateCount,
        references,
      };
    } catch (error) {
      logger.error('Error replacing media', { error, oldUrl, newUrl });
      throw error;
    }
  }

  /**
   * Extract filename from URL
   */
  private extractFilename(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Extract thumbnail URL (for Cloudinary URLs)
   */
  private extractThumbnailUrl(url: string): string {
    // If it's a Cloudinary URL, generate thumbnail transformation
    if (url.includes('cloudinary.com')) {
      const publicId = this.extractPublicId(url);
      if (publicId) {
        const isVideo = this.detectMediaType(url) === 'video';
        return cloudinaryService.getThumbnailUrl(publicId, 300, 300, isVideo ? 'video' : 'image');
      }
    }
    return url;
  }

  /**
   * Extract Cloudinary public ID from URL
   */
  private extractPublicId(url: string): string | null {
    try {
      // Remove query parameters first
      const cleanUrl = url.split('?')[0];
      
      // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
      const match = cleanUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Detect media type from URL
   */
  private detectMediaType(url: string): 'image' | 'video' {
    const lowerUrl = url.toLowerCase();
    
    // Check for Cloudinary video resource type in URL path
    if (lowerUrl.includes('/video/upload/')) {
      return 'video';
    }
    
    // Check for video file extensions anywhere in the URL (not just at the end)
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    if (videoExtensions.some((ext) => lowerUrl.includes(ext))) {
      return 'video';
    }
    
    return 'image';
  }
}

// Export singleton instance
export const mediaLibraryService = new MediaLibraryService();
