import { Router } from 'express';
import { validateCsrfToken } from '../../middleware/csrf';
import productRoutes from './products';
import galleryRoutes from './gallery';
import homeRoutes from './home';
import mediaRoutes from './media';
import auditRoutes from './audit';
import messageRoutes from './messages';
import categoryRoutes from './categories';
import uploadRoutes from './upload';

const router = Router();

// Apply CSRF validation to all admin routes
router.use(validateCsrfToken);

// Admin category routes
router.use('/categories', categoryRoutes);

// Admin product routes
router.use('/products', productRoutes);

// Admin gallery routes
router.use('/gallery', galleryRoutes);

// Admin home content routes
router.use('/home', homeRoutes);

// Admin media library routes
router.use('/media', mediaRoutes);

// Admin audit log routes
router.use('/audit', auditRoutes);

// Admin message routes
router.use('/messages', messageRoutes);

// Admin upload routes
router.use('/upload', uploadRoutes);

export default router;
