/**
 * Cleanup Script: Remove orphaned gallery images
 * 
 * This script finds and deletes gallery images that don't belong to any existing product.
 * Run this script to clean up images left behind from previously deleted products.
 */

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { GalleryImage } from '../models/GalleryImage';
import { cloudinaryService } from '../services/cloudinaryService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function cleanupOrphanedGalleryImages() {
  try {
    console.log('🔍 Starting cleanup of orphaned gallery images...\n');

    // Connect to MongoDB
    const mongoUri = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/ebenor-creation';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all products and their image URLs
    const products = await Product.find({}).lean();
    const productImageUrls = new Set<string>();
    
    products.forEach(product => {
      const productData = product as any;
      if (productData['images'] && Array.isArray(productData['images'])) {
        productData['images'].forEach((img: any) => {
          if (img['url']) {
            productImageUrls.add(img['url']);
          }
        });
      }
    });

    console.log(`📦 Found ${products.length} product(s) with ${productImageUrls.size} unique image URL(s)\n`);

    // Get all gallery images
    const galleryImages = await GalleryImage.find({}).lean();
    console.log(`🖼️  Found ${galleryImages.length} gallery image(s)\n`);

    // Find orphaned images (gallery images not referenced by any product)
    const orphanedImages = galleryImages.filter(img => {
      const imgData = img as any;
      return !productImageUrls.has(imgData['url']);
    });
    
    console.log(`🗑️  Found ${orphanedImages.length} orphaned image(s) to delete:\n`);

    if (orphanedImages.length === 0) {
      console.log('✨ No orphaned images found. Gallery is clean!\n');
      await mongoose.disconnect();
      return;
    }

    // Display orphaned images
    orphanedImages.forEach((img, index) => {
      const imgData = img as any;
      console.log(`   ${index + 1}. ${imgData['title'] || 'Untitled'}`);
      console.log(`      URL: ${imgData['url']}`);
      console.log(`      Category: ${imgData['category']}`);
      console.log(`      Uploaded: ${imgData['uploadedAt'] || 'Unknown'}\n`);
    });

    // Delete orphaned images from database
    const orphanedUrls = orphanedImages.map(img => (img as any)['url']);
    const deleteResult = await GalleryImage.deleteMany({
      url: { $in: orphanedUrls }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} orphaned image(s) from database\n`);

    // Delete from Cloudinary
    let cloudinaryDeletedCount = 0;
    let cloudinaryFailedCount = 0;

    console.log('☁️  Deleting images from Cloudinary...\n');

    for (const img of orphanedImages) {
      try {
        const imgData = img as any;
        // Extract public_id from URL
        const urlMatch = imgData['url'].match(/\/([^/]+)\.(jpg|jpeg|png|webp|mp4|mov)$/i);
        if (urlMatch && urlMatch[1]) {
          const publicId = `ebenor-creation/products/${urlMatch[1]}`;
          await cloudinaryService.deleteFile(publicId, 'image');
          cloudinaryDeletedCount++;
          console.log(`   ✅ Deleted from Cloudinary: ${imgData['title'] || 'Untitled'}`);
        } else {
          console.log(`   ⚠️  Could not extract public_id from: ${imgData['url']}`);
        }
      } catch (error) {
        const imgData = img as any;
        cloudinaryFailedCount++;
        console.log(`   ❌ Failed to delete from Cloudinary: ${imgData['title'] || 'Untitled'}`);
        console.log(`      Error: ${(error as Error).message}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Orphaned images found: ${orphanedImages.length}`);
    console.log(`   - Deleted from database: ${deleteResult.deletedCount}`);
    console.log(`   - Deleted from Cloudinary: ${cloudinaryDeletedCount}`);
    console.log(`   - Failed Cloudinary deletions: ${cloudinaryFailedCount}`);
    console.log(`\n✨ Cleanup completed successfully!\n`);

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedGalleryImages()
  .then(() => {
    console.log('🎉 Script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
