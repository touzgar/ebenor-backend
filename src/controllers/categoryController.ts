import { Request, Response, NextFunction } from 'express';
import { Category } from '../models/Category';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse, PaginatedResponse } from '../types';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cacheService';

export class CategoryController {
  /**
   * Get all categories
   * GET /api/admin/categories
   */
  public async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const query: any = {};

      // Filter by active status
      if (req.query.isActive !== undefined) {
        query.isActive = req.query.isActive === 'true';
      }

      // Search by name
      if (req.query.search) {
        query.name = { $regex: req.query.search, $options: 'i' };
      }

      const [categories, total] = await Promise.all([
        Category.find(query).sort({ displayOrder: 1, name: 1 }).skip(skip).limit(limit).lean(),
        Category.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<typeof categories[0]> = {
        success: true,
        data: categories,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category by ID
   * GET /api/admin/categories/:id
   */
  public async getCategoryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await Category.findById(req.params.id).lean();

      if (!category) {
        throw new ApiError('Catégorie non trouvée', 404, ERROR_CODES.NOT_FOUND);
      }

      const response: ApiResponse = {
        success: true,
        data: category,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create category
   * POST /api/admin/categories
   */
  public async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, icon, color, isActive, displayOrder } = req.body;

      if (!name) {
        throw new ApiError('Le nom de la catégorie est requis', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      // Generate slug from name
      const slug = name
        .toLowerCase()
        .trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Check if category with same name or slug exists
      const existingCategory = await Category.findOne({
        $or: [{ name }, { slug }],
      });

      if (existingCategory) {
        throw new ApiError('Une catégorie avec ce nom existe déjà', 409, ERROR_CODES.DUPLICATE_ERROR);
      }

      const category = new Category({
        name,
        slug,
        description,
        icon,
        color: color || '#f59e0b',
        isActive: isActive !== undefined ? isActive : true,
        displayOrder: displayOrder || 0,
      });

      await category.save();

      // Invalidate product categories cache
      cacheService.del('products:categories');
      cacheService.delPattern('^products:list:');

      logger.info('Category created', { categoryId: category._id, name });

      const response: ApiResponse = {
        success: true,
        message: 'Catégorie créée avec succès',
        data: category,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update category
   * PUT /api/admin/categories/:id
   */
  public async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, icon, color, isActive, displayOrder } = req.body;

      const category = await Category.findById(req.params.id);

      if (!category) {
        throw new ApiError('Catégorie non trouvée', 404, ERROR_CODES.NOT_FOUND);
      }

      // If name is being updated, regenerate slug
      if (name && name !== category.name) {
        const slug = name
          .toLowerCase()
          .trim()
          .replace(/[àáâãäå]/g, 'a')
          .replace(/[èéêë]/g, 'e')
          .replace(/[ìíîï]/g, 'i')
          .replace(/[òóôõö]/g, 'o')
          .replace(/[ùúûü]/g, 'u')
          .replace(/[ç]/g, 'c')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        // Check if another category has the same name or slug
        const existingCategory = await Category.findOne({
          _id: { $ne: req.params.id },
          $or: [{ name }, { slug }],
        });

        if (existingCategory) {
          throw new ApiError('Une catégorie avec ce nom existe déjà', 409, ERROR_CODES.DUPLICATE_ERROR);
        }

        category.name = name;
        category.slug = slug;
      }

      if (description !== undefined) category.description = description;
      if (icon !== undefined) category.icon = icon;
      if (color !== undefined) category.color = color;
      if (isActive !== undefined) category.isActive = isActive;
      if (displayOrder !== undefined) category.displayOrder = displayOrder;

      await category.save();

      // Invalidate product categories cache
      cacheService.del('products:categories');
      cacheService.delPattern('^products:list:');

      logger.info('Category updated', { categoryId: category._id, name: category.name });

      const response: ApiResponse = {
        success: true,
        message: 'Catégorie mise à jour avec succès',
        data: category,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete category
   * DELETE /api/admin/categories/:id
   */
  public async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await Category.findById(req.params.id);

      if (!category) {
        throw new ApiError('Catégorie non trouvée', 404, ERROR_CODES.NOT_FOUND);
      }

      await category.deleteOne();

      // Invalidate product categories cache
      cacheService.del('products:categories');
      cacheService.delPattern('^products:list:');

      logger.info('Category deleted', { categoryId: req.params.id, name: category.name });

      const response: ApiResponse = {
        success: true,
        message: 'Catégorie supprimée avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Initialize default categories
   * POST /api/admin/categories/initialize
   */
  public async initializeCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const defaultCategories = [
        {
          name: 'Cuisine',
          slug: 'cuisine',
          description: 'Meubles de cuisine sur mesure',
          icon: '🍳',
          color: '#ef4444',
          displayOrder: 1,
        },
        {
          name: 'Dressing',
          slug: 'dressing',
          description: 'Dressings et rangements personnalisés',
          icon: '👔',
          color: '#3b82f6',
          displayOrder: 2,
        },
        {
          name: 'Mobilier',
          slug: 'mobilier',
          description: 'Mobilier sur mesure pour tous espaces',
          icon: '🪑',
          color: '#10b981',
          displayOrder: 3,
        },
        {
          name: 'Aménagement',
          slug: 'amenagement',
          description: 'Aménagement intérieur complet',
          icon: '🏠',
          color: '#f59e0b',
          displayOrder: 4,
        },
      ];

      const created: any[] = [];
      const skipped: any[] = [];

      for (const categoryData of defaultCategories) {
        const existing = await Category.findOne({
          $or: [{ name: categoryData.name }, { slug: categoryData.slug }],
        });

        if (!existing) {
          const category = new Category(categoryData);
          await category.save();
          created.push(category);
          logger.info('Default category created', { name: categoryData.name });
        } else {
          skipped.push({ name: categoryData.name, reason: 'Already exists' });
        }
      }

      // Invalidate product categories cache
      cacheService.del('products:categories');
      cacheService.delPattern('^products:list:');

      const response: ApiResponse = {
        success: true,
        message: `${created.length} catégorie(s) créée(s), ${skipped.length} ignorée(s)`,
        data: {
          created,
          skipped,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const categoryController = new CategoryController();
