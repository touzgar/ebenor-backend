import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class ProductController {
  /**
   * Obtenir tous les produits avec pagination et filtres
   */
  public async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        subcategory,
        availability,
        featured,
        search,
        sort = '-createdAt',
        minPrice,
        maxPrice,
        materials,
        tags,
      } = req.query;

      // Construire le filtre
      const filter: any = {};

      if (category) {
        filter.category = category;
      }

      if (subcategory) {
        filter.subcategory = subcategory;
      }

      if (availability) {
        filter.availability = availability;
      }

      if (featured !== undefined) {
        filter.featured = featured === 'true';
      }

      // Filtre de prix
      if (minPrice || maxPrice) {
        filter['price.amount'] = {};
        if (minPrice) filter['price.amount'].$gte = Number(minPrice);
        if (maxPrice) filter['price.amount'].$lte = Number(maxPrice);
      }

      // Filtre de matériaux
      if (materials) {
        const materialsArray = (materials as string).split(',');
        filter.materials = { $in: materialsArray };
      }

      // Filtre de tags
      if (tags) {
        const tagsArray = (tags as string).split(',');
        filter.tags = { $in: tagsArray };
      }

      // Recherche textuelle
      if (search) {
        filter.$text = { $search: search as string };
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Exécuter la requête avec pagination
      const [products, total] = await Promise.all([
        Product.find(filter)
          .sort(sort as string)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      const response: ApiResponse = {
        success: true,
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages,
          hasMore: pageNum < totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir un produit par son slug
   */
  public async getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;

      const product = await Product.findOne({ slug }).lean();

      if (!product) {
        throw new ApiError(
          'Produit non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: product,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir un produit par son ID
   */
  public async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'ID de produit invalide',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const product = await Product.findById(id).lean();

      if (!product) {
        throw new ApiError(
          'Produit non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const response: ApiResponse = {
        success: true,
        data: product,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les produits en vedette
   */
  public async getFeaturedProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 6 } = req.query;
      const limitNum = Math.min(20, Math.max(1, Number(limit)));

      const products = await Product.find({ featured: true })
        .sort('-createdAt')
        .limit(limitNum)
        .lean();

      const response: ApiResponse = {
        success: true,
        data: products,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les catégories de produits disponibles avec le nombre de produits
   */
  public async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Obtenir toutes les catégories actives
      const categories = await Category.find({ isActive: true })
        .sort('displayOrder name')
        .lean();

      // Si aucune catégorie n'existe, utiliser les catégories distinctes des produits
      if (categories.length === 0) {
        const productCategories = await Product.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        
        const categoriesData = productCategories.map(cat => ({
          category: cat._id,
          name: cat._id,
          slug: cat._id.toLowerCase().replace(/\s+/g, '-'),
          count: cat.count,
          isActive: true,
        }));

        const response: ApiResponse = {
          success: true,
          data: categoriesData,
        };

        res.status(200).json(response);
        return;
      }

      // Compter les produits pour chaque catégorie
      const categoriesWithCount = await Promise.all(
        categories.map(async (category) => {
          const count = await Product.countDocuments({ 
            category: category.slug 
          });
          
          return {
            category: category.slug,
            name: category.name,
            slug: category.slug,
            description: category.description,
            icon: category.icon,
            color: category.color,
            count: count,
            displayOrder: category.displayOrder,
          };
        })
      );

      // Retourner TOUTES les catégories actives (même celles avec 0 produits)
      // Trier par displayOrder puis par nom
      const allCategories = categoriesWithCount
        .sort((a, b) => {
          // Trier par displayOrder puis par count
          if (a.displayOrder !== b.displayOrder) {
            return a.displayOrder - b.displayOrder;
          }
          return b.count - a.count;
        });

      const response: ApiResponse = {
        success: true,
        data: allCategories,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rechercher des produits
   */
  public async searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, page = 1, limit = 12 } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        throw new ApiError(
          'Requête de recherche requise',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Recherche textuelle avec score
      const [products, total] = await Promise.all([
        Product.find(
          { $text: { $search: q as string } },
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments({ $text: { $search: q as string } }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      const response: ApiResponse = {
        success: true,
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages,
          hasMore: pageNum < totalPages,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir des produits similaires
   */
  public async getSimilarProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = 4 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'ID de produit invalide',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const product = await Product.findById(id);

      if (!product) {
        throw new ApiError(
          'Produit non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      const limitNum = Math.min(20, Math.max(1, Number(limit)));

      // Trouver des produits similaires basés sur la catégorie et les tags
      const similarProducts = await Product.find({
        _id: { $ne: id },
        $or: [
          { category: product.category },
          { tags: { $in: product.tags } },
        ],
      })
        .sort('-featured -createdAt')
        .limit(limitNum)
        .lean();

      const response: ApiResponse = {
        success: true,
        data: similarProducts,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques des produits
   */
  public async getProductStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalProducts,
        featuredCount,
        categoryStats,
        priceStats,
      ] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ featured: true }),
        Product.aggregate([
          {
            $group: {
              _id: null,
              categoriesCount: { $addToSet: '$category' },
            },
          },
        ]),
        Product.aggregate([
          {
            $group: {
              _id: null,
              avgPrice: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
            },
          },
        ]),
      ]);

      const categoriesCount = categoryStats[0]?.categoriesCount?.length || 0;
      const priceData = priceStats[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 };

      const stats = {
        totalProducts: totalProducts,
        featuredProducts: featuredCount,
        categoriesCount: categoriesCount,
        avgPrice: Math.round(priceData.avgPrice || 0),
        minPrice: Math.round(priceData.minPrice || 0),
        maxPrice: Math.round(priceData.maxPrice || 0),
      };

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir la répartition des produits par catégorie
   */
  public async getProductCategoriesBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categoryBreakdown = await Product.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            subcategories: { $addToSet: '$subcategory' },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            count: 1,
            subcategories: {
              $filter: {
                input: '$subcategories',
                as: 'sub',
                cond: { $ne: ['$$sub', null] },
              },
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      const response: ApiResponse = {
        success: true,
        data: categoryBreakdown,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Créer un nouveau produit (Admin only)
   */
  public async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const productData = req.body;

      // Ajouter l'utilisateur qui crée le produit
      if (req.user) {
        productData.createdBy = req.user.email || req.user.id;
      }

      const product = new Product(productData);
      await product.save();

      logger.info('Product created', {
        productId: product._id,
        name: product.name,
        createdBy: productData.createdBy,
      });

      const response: ApiResponse = {
        success: true,
        data: product,
        message: 'Produit créé avec succès',
      };

      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === 11000) {
        next(new ApiError(
          'Un produit avec ce slug existe déjà',
          409,
          ERROR_CODES.DUPLICATE_ERROR
        ));
      } else {
        next(error);
      }
    }
  }

  /**
   * Mettre à jour un produit (Admin only)
   */
  public async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'ID de produit invalide',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Ajouter l'utilisateur qui modifie le produit
      if (req.user) {
        updateData.updatedBy = req.user.email || req.user.id;
      }

      const product = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        throw new ApiError(
          'Produit non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      logger.info('Product updated', {
        productId: product._id,
        name: product.name,
        updatedBy: updateData.updatedBy,
      });

      const response: ApiResponse = {
        success: true,
        data: product,
        message: 'Produit mis à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 11000) {
        next(new ApiError(
          'Un produit avec ce slug existe déjà',
          409,
          ERROR_CODES.DUPLICATE_ERROR
        ));
      } else {
        next(error);
      }
    }
  }

  /**
   * Supprimer un produit (Admin only)
   */
  public async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'ID de produit invalide',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Find the product first to get its images and video
      const product = await Product.findById(id);

      if (!product) {
        throw new ApiError(
          'Produit non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Extract all image URLs and video URL from the product
      const imageUrls = product.images?.map((img: { url: string }) => img.url) || [];
      const mediaUrls = [...imageUrls];
      
      // Add video URL if exists
      if (product.video && product.video.url) {
        mediaUrls.push(product.video.url);
      }

      // Delete the product from database first
      await Product.findByIdAndDelete(id);

      // Delete associated gallery images that have matching URLs
      let deletedGalleryCount = 0;
      if (mediaUrls.length > 0) {
        const { GalleryImage } = await import('../models/GalleryImage');
        const deleteResult = await GalleryImage.deleteMany({
          url: { $in: mediaUrls }
        });
        deletedGalleryCount = deleteResult.deletedCount || 0;

        if (deletedGalleryCount > 0) {
          logger.info('Deleted gallery images matching product media', {
            productId: id,
            count: deletedGalleryCount,
          });
        }
      }

      // Delete associated media from Cloudinary
      let deletedFromCloudinaryCount = 0;
      if (mediaUrls.length > 0) {
        const { cloudinaryService } = await import('../services/cloudinaryService');
        
        for (const url of mediaUrls) {
          try {
            // Extract public ID from Cloudinary URL
            // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{folder}/{public_id}.{extension}
            const urlMatch = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(\w+)(?:\?|$)/);
            
            if (urlMatch && urlMatch[1]) {
              const publicIdWithFolder = urlMatch[1];
              const extension = urlMatch[2].toLowerCase();
              
              // Determine if it's a video or image
              const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv'];
              const isVideo = videoExtensions.includes(extension) || url.includes('/video/upload/');
              
              // Try to delete from Cloudinary
              try {
                await cloudinaryService.deleteFile(publicIdWithFolder, isVideo ? 'video' : 'image');
                deletedFromCloudinaryCount++;
                logger.info(`Deleted ${isVideo ? 'video' : 'image'} from Cloudinary`, {
                  publicId: publicIdWithFolder,
                  url,
                  productId: id,
                });
              } catch (cloudError: any) {
                // If the error is "not found" (404), it's already deleted, so continue
                if (cloudError.http_code === 404 || cloudError.message?.includes('not found')) {
                  logger.info(`Media already deleted from Cloudinary`, {
                    publicId: publicIdWithFolder,
                    url,
                  });
                } else {
                  logger.warn('Failed to delete media from Cloudinary', {
                    publicId: publicIdWithFolder,
                    url,
                    error: cloudError,
                  });
                }
              }
            }
          } catch (parseError) {
            logger.warn('Failed to parse media URL for deletion', {
              url,
              error: parseError,
            });
          }
        }
      }

      logger.info('Product deleted', {
        productId: id,
        name: product.name,
        deletedBy: req.user?.email || req.user?.id,
        mediaCount: mediaUrls.length,
        galleryImagesDeleted: deletedGalleryCount,
        cloudinaryMediaDeleted: deletedFromCloudinaryCount,
      });

      const response: ApiResponse = {
        success: true,
        data: { 
          id,
          deletedMediaCount: mediaUrls.length,
          deletedGalleryCount,
          cloudinaryMediaDeleted: deletedFromCloudinaryCount,
        },
        message: `Produit supprimé avec succès (${deletedGalleryCount} image(s) galerie + ${deletedFromCloudinaryCount} média(s) Cloudinary supprimé(s))`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Opérations en masse (Admin only)
   */
  public async bulkOperations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operation, ids, data } = req.body;

      if (!operation || !ids || !Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(
          'Opération et IDs requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Valider tous les IDs
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        throw new ApiError(
          'Un ou plusieurs IDs sont invalides',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let result;
      let deletedImagesCount = 0;

      switch (operation) {
        case 'delete':
          // Find products first to get their image and video URLs
          const productsToDelete = await Product.find({ _id: { $in: validIds } });
          const allMediaUrls: string[] = [];
          
          productsToDelete.forEach(product => {
            // Add image URLs
            if (product.images && product.images.length > 0) {
              product.images.forEach((img: { url: string }) => allMediaUrls.push(img.url));
            }
            // Add video URL
            if (product.video && product.video.url) {
              allMediaUrls.push(product.video.url);
            }
          });

          // Delete the products from database
          result = await Product.deleteMany({ _id: { $in: validIds } });
          
          // Delete associated gallery images
          let galleryDeletedCount = 0;
          if (allMediaUrls.length > 0) {
            const { GalleryImage } = await import('../models/GalleryImage');
            const galleryResult = await GalleryImage.deleteMany({
              url: { $in: allMediaUrls }
            });
            galleryDeletedCount = galleryResult.deletedCount || 0;
          }
          
          // Delete associated media from Cloudinary
          let cloudinaryDeletedCount = 0;
          if (allMediaUrls.length > 0) {
            const { cloudinaryService } = await import('../services/cloudinaryService');
            
            for (const url of allMediaUrls) {
              try {
                // Extract public ID from Cloudinary URL
                const urlMatch = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(\w+)(?:\?|$)/);
                
                if (urlMatch && urlMatch[1]) {
                  const publicIdWithFolder = urlMatch[1];
                  const extension = urlMatch[2].toLowerCase();
                  
                  // Determine if it's a video or image
                  const videoExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv'];
                  const isVideo = videoExtensions.includes(extension) || url.includes('/video/upload/');
                  
                  try {
                    await cloudinaryService.deleteFile(publicIdWithFolder, isVideo ? 'video' : 'image');
                    cloudinaryDeletedCount++;
                  } catch (cloudError: any) {
                    if (cloudError.http_code !== 404 && !cloudError.message?.includes('not found')) {
                      logger.warn('Failed to delete media from Cloudinary during bulk delete', {
                        url,
                        error: cloudError
                      });
                    }
                  }
                }
              } catch (parseError) {
                logger.warn('Failed to parse media URL during bulk delete', {
                  url,
                  error: parseError
                });
              }
            }
          }

          deletedImagesCount = galleryDeletedCount + cloudinaryDeletedCount;

          logger.info('Bulk delete products', {
            productsDeleted: result.deletedCount,
            galleryDeleted: galleryDeletedCount,
            cloudinaryDeleted: cloudinaryDeletedCount,
            deletedBy: req.user?.email || req.user?.id,
          });
          break;

        case 'update':
          if (!data) {
            throw new ApiError(
              'Données de mise à jour requises',
              400,
              ERROR_CODES.VALIDATION_ERROR
            );
          }
          const updateData = { ...data };
          if (req.user) {
            updateData.updatedBy = req.user.email || req.user.id;
          }
          result = await Product.updateMany(
            { _id: { $in: validIds } },
            { $set: updateData }
          );
          logger.info('Bulk update products', {
            count: result.modifiedCount,
            updatedBy: req.user?.email || req.user?.id,
          });
          break;

        case 'toggleFeatured':
          // Toggle featured status
          const products = await Product.find({ _id: { $in: validIds } });
          await Promise.all(
            products.map(async (product) => {
              product.featured = !product.featured;
              if (req.user) {
                product.updatedBy = req.user.email || req.user.id;
              }
              return product.save();
            })
          );
          result = { modifiedCount: products.length };
          logger.info('Bulk toggle featured products', {
            count: products.length,
            updatedBy: req.user?.email || req.user?.id,
          });
          break;

        default:
          throw new ApiError(
            'Opération invalide',
            400,
            ERROR_CODES.VALIDATION_ERROR
          );
      }

      const responseData = operation === 'delete' 
        ? { ...result, deletedImagesCount }
        : result;

      const response: ApiResponse = {
        success: true,
        data: responseData,
        message: operation === 'delete'
          ? `${validIds.length} produit(s) et ${deletedImagesCount} image(s) supprimé(s) avec succès`
          : `Opération "${operation}" effectuée avec succès sur ${validIds.length} produit(s)`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Instance du contrôleur de produits
export const productController = new ProductController();
