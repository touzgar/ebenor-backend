import { Router } from 'express';
import { categoryController } from '../../controllers/categoryController';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Initialize default categories
router.post('/initialize', categoryController.initializeCategories.bind(categoryController));

// Get all categories
router.get('/', categoryController.getAllCategories.bind(categoryController));

// Get category by ID
router.get('/:id', categoryController.getCategoryById.bind(categoryController));

// Create category
router.post('/', categoryController.createCategory.bind(categoryController));

// Update category
router.put('/:id', categoryController.updateCategory.bind(categoryController));

// Delete category
router.delete('/:id', categoryController.deleteCategory.bind(categoryController));

export default router;
