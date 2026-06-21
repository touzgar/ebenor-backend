import { Router } from 'express';
import { galleryController } from '../../controllers/galleryController';
import { authenticate } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/security';
import { 
  validateGalleryImage, 
  validateObjectIdParam,
  validateBulkOperation,
  validateSortOrder
} from '../../middleware/validation';
import multer from 'multer';

const router = Router();

// Configure multer for image and video upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB (to accommodate videos)
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Formats acceptés: JPG, PNG, WebP, MP4, WebM'));
    }
  },
});

// Toutes les routes admin nécessitent une authentification
router.use(authenticate);

// Cleanup orphaned images
router.post('/cleanup-orphaned', galleryController.cleanupOrphanedImages.bind(galleryController));

// Upload image
router.post('/upload', uploadLimiter, upload.any(), galleryController.uploadImage.bind(galleryController));

// CRUD operations
router.post('/', uploadLimiter, validateGalleryImage, galleryController.createGalleryImage.bind(galleryController));
router.put('/:id', uploadLimiter, validateObjectIdParam('id'), validateGalleryImage, galleryController.updateGalleryImage.bind(galleryController));
router.delete('/:id', validateObjectIdParam('id'), galleryController.deleteGalleryImage.bind(galleryController));

// Bulk operations
router.post('/bulk', validateBulkOperation, galleryController.bulkOperations.bind(galleryController));

// Update sort order
router.put('/sort-order', validateSortOrder, galleryController.updateSortOrder.bind(galleryController));

// Get image by ID (for editing)
router.get('/:id', validateObjectIdParam('id'), galleryController.getImageById.bind(galleryController));

export default router;
