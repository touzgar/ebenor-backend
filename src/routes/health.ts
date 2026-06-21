import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', (req: Request, res: Response) => {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();
  
  res.status(200).json({
    status: 'OK',
    message: 'API is healthy',
    timestamp,
    uptime: Math.floor(uptime),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
