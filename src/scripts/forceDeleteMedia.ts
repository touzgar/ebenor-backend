import 'dotenv/config';
import { config } from '../config/database';
import { mediaLibraryService } from '../services/mediaLibraryService';
import { Product } from '../models/Product';
import { GalleryImage } from '../models/GalleryImage';
import { HomeContent } from '../models/HomeContent';
import { logger } from '../utils/logger';

async function run() {
  try {
    await config.connectDB();

    const { media } = await mediaLibraryService.getAllMedia(1, 10000, {});
    logger.info(`Found ${media.length} media items`);

    for (const item of media) {
      logger.info('Processing media', { url: item.url, source: item.source, id: item.sourceId });

      // Remove product references
      const refs = item.references || [];
      for (const ref of refs) {
        if (ref.type === 'product') {
          try {
            await Product.findByIdAndUpdate(ref.id, { $pull: { images: { url: item.url } } });
            logger.info('Removed image reference from product', { productId: ref.id, url: item.url });
          } catch (err) {
            logger.warn('Failed removing product reference', { error: err, productId: ref.id, url: item.url });
          }
        } else if (ref.type === 'gallery') {
          try {
            await GalleryImage.findByIdAndDelete(ref.id);
            logger.info('Deleted gallery image document', { galleryId: ref.id, url: item.url });
          } catch (err) {
            logger.warn('Failed deleting gallery image', { error: err, galleryId: ref.id });
          }
        } else if (ref.type === 'homepage') {
          try {
            const home = await HomeContent.findOne();
            if (home) {
              // Attempt a simple replace: remove occurrences of the URL in JSON fields
              const replacer = (obj: any) => {
                if (!obj) return obj;
                if (typeof obj === 'string') return obj === item.url ? '' : obj;
                if (Array.isArray(obj)) return obj.map(replacer);
                if (typeof obj === 'object') {
                  for (const k of Object.keys(obj)) obj[k] = replacer(obj[k]);
                  return obj;
                }
                return obj;
              };
              const updated = replacer(home.toObject());
              await HomeContent.findByIdAndUpdate(home._id, updated);
              logger.info('Cleaned homepage references', { url: item.url });
            }
          } catch (err) {
            logger.warn('Failed cleaning homepage reference', { error: err });
          }
        }
      }

      // After removing references, attempt deletion via service
      try {
        const res = await mediaLibraryService.deleteMedia(item.url);
        if (res.deleted) {
          logger.info('Deleted media', { url: item.url });
        } else {
          logger.warn('Media not deleted (still referenced)', { url: item.url, references: res.references.length });
        }
      } catch (err) {
        logger.error('Error deleting media via service', { error: err, url: item.url });
      }
    }

    logger.info('Finished processing all media items');
    process.exit(0);
  } catch (error) {
    logger.error('Force delete script failed', { error });
    process.exit(1);
  }
}

void run();
