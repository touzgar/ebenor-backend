import express from 'express';
import { getShowroomContent, updateShowroomContent } from '../controllers/showroomController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/showroom
 * @desc    Get showroom content (public)
 */
router.get('/', getShowroomContent);

/**
 * @route   PUT /api/showroom
 * @desc    Update showroom content (admin only)
 */
router.put('/', authenticate, authorize('super_admin', 'admin'), updateShowroomContent);

export default router;
