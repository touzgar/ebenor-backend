import mongoose from 'mongoose';
import { GalleryImage } from '../models/GalleryImage';
import { logger } from '../utils/logger';
import { cloudinaryService } from '../services/cloudinaryService';

async function clearAllGalleryImages() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ebenor-creation';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');

    // Get all gallery images
    const allImages = await GalleryImage.find({});
    logger.info(`Found ${allImages.length} gallery images to delete`);

    // Delete from Cloudinary
    let cloudinaryDeleted = 0;
    for (const img of allImages) {
      try {
        // Extract public ID from URL
        const urlMatch = img.url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(\w+)(?:\?|$)/);
        if (urlMatch && urlMatch[1]) {
          const publicId = urlMatch[1];
          await cloudinaryService.deleteFile(publicId, 'image');
          cloudinaryDeleted++;
          logger.info(`Deleted from Cloudinary: ${publicId}`);
        }
      } catch (error) {
        logger.warn(`Failed to delete from Cloudinary: ${img.url}`, { error });
      }
    }

    // Delete all from database
    const result = await GalleryImage.deleteMany({});
    logger.info(`Deleted ${result.deletedCount} images from database`);
    logger.info(`Deleted ${cloudinaryDeleted} images from Cloudinary`);

    console.log('\n✅ Gallery cleanup completed!');
    console.log(`   - Database: ${result.deletedCount} deleted`);
    console.log(`   - Cloudinary: ${cloudinaryDeleted} deleted`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error clearing gallery images', { error });
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearAllGalleryImages();
