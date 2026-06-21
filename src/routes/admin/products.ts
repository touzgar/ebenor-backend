import { Router } from 'express';
import { productController } from '../../controllers/productController';
import { authenticate } from '../../middleware/auth';
import { uploadLimiter } from '../../middleware/security';
import { 
  validateProduct, 
  validateObjectIdParam,
  validateBulkOperation
} from '../../middleware/validation';

const router = Router();

// Toutes les routes admin nécessitent une authentification
router.use(authenticate);

// Get all products (for admin list view)
router.get('/', productController.getProducts.bind(productController));

// CRUD operations
router.post('/', uploadLimiter, validateProduct, productController.createProduct.bind(productController));
router.put('/:id', uploadLimiter, validateObjectIdParam('id'), validateProduct, productController.updateProduct.bind(productController));
router.delete('/:id', validateObjectIdParam('id'), productController.deleteProduct.bind(productController));

// Bulk operations
router.post('/bulk', validateBulkOperation, productController.bulkOperations.bind(productController));

// Get product by ID (for editing)
router.get('/:id', validateObjectIdParam('id'), productController.getProductById.bind(productController));

export default router;
