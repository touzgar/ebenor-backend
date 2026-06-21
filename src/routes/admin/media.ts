import { Router } from 'express';
import { mediaLibraryController } from '../../controllers/mediaLibraryController';
import { authenticate } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/security';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for images
  },
});

// All routes require authentication
router.use(authenticate);

// Get all media with pagination and filters
router.get('/', mediaLibraryController.getAllMedia.bind(mediaLibraryController));

// Get media statistics
router.get('/stats', mediaLibraryController.getMediaStats.bind(mediaLibraryController));

// Get storage usage
router.get('/storage', mediaLibraryController.getStorageUsage.bind(mediaLibraryController));

// Search media
router.get('/search', mediaLibraryController.searchMedia.bind(mediaLibraryController));

// Find media references
router.get('/references', mediaLibraryController.findMediaReferences.bind(mediaLibraryController));

// Get media by category
router.get('/by-category/:category', mediaLibraryController.getMediaByCategory.bind(mediaLibraryController));

// Get media by source
router.get('/by-source/:source', mediaLibraryController.getMediaBySource.bind(mediaLibraryController));

// Delete media
router.delete('/', mediaLibraryController.deleteMedia.bind(mediaLibraryController));

// Delete all media
router.delete('/all', mediaLibraryController.deleteAllMedia.bind(mediaLibraryController));

// Replace media
router.put('/:id/replace', mediaLibraryController.replaceMedia.bind(mediaLibraryController));

// Upload and replace media (with rate limiting)
router.post(
  '/upload-replace',
  uploadLimiter,
  upload.single('file'),
  mediaLibraryController.uploadAndReplace.bind(mediaLibraryController)
);

export default router;
