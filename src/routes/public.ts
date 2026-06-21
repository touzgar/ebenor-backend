import { Router } from 'express';
import { homeController } from '../controllers/homeController';
import { productController } from '../controllers/productController';
import { galleryController } from '../controllers/galleryController';
import { messageController } from '../controllers/messageController';
import { contactLimiter } from '../middleware/security';
import { 
  validateMessage,
  validatePagination,
  validateProductFilters,
  validateObjectIdParam
} from '../middleware/validation';
import { CacheStrategies } from '../middleware/caching';

const router = Router();

// ===== ROUTES HOME =====

/**
 * @route   GET /api/home
 * @desc    Obtenir le contenu de la page d'accueil
 * @access  Public
 */
router.get('/home', CacheStrategies.short(), homeController.getHomeContent);

/**
 * @route   GET /api/home/stats
 * @desc    Obtenir les statistiques de la page d'accueil
 * @access  Public
 */
router.get('/home/stats', CacheStrategies.short(), homeController.getHomeStats);

// ===== ROUTES PRODUCTS =====

/**
 * @route   GET /api/products
 * @desc    Obtenir tous les produits avec pagination et filtres
 * @access  Public
 */
router.get('/products', CacheStrategies.short(), validatePagination, validateProductFilters, productController.getProducts);

/**
 * @route   GET /api/products/featured
 * @desc    Obtenir les produits en vedette
 * @access  Public
 */
router.get('/products/featured', CacheStrategies.medium(), productController.getFeaturedProducts);

/**
 * @route   GET /api/products/categories/breakdown
 * @desc    Obtenir la répartition des produits par catégorie
 * @access  Public
 */
router.get('/products/categories/breakdown', CacheStrategies.short(), productController.getProductCategoriesBreakdown);

/**
 * @route   GET /api/products/categories
 * @desc    Obtenir les catégories de produits disponibles
 * @access  Public
 */
router.get('/products/categories', CacheStrategies.long(), productController.getCategories);

/**
 * @route   GET /api/products/search
 * @desc    Rechercher des produits
 * @access  Public
 */
router.get('/products/search', CacheStrategies.short(), validatePagination, productController.searchProducts);

/**
 * @route   GET /api/products/stats
 * @desc    Obtenir les statistiques des produits
 * @access  Public
 */
router.get('/products/stats', CacheStrategies.noCache(), productController.getProductStats);

/**
 * @route   GET /api/products/slug/:slug
 * @desc    Obtenir un produit par son slug
 * @access  Public
 */
router.get('/products/slug/:slug', CacheStrategies.medium(), productController.getProductBySlug);

/**
 * @route   GET /api/products/:id
 * @desc    Obtenir un produit par son ID
 * @access  Public
 */
router.get('/products/:id', CacheStrategies.medium(), validateObjectIdParam('id'), productController.getProductById);

/**
 * @route   GET /api/products/:id/similar
 * @desc    Obtenir des produits similaires
 * @access  Public
 */
router.get('/products/:id/similar', CacheStrategies.medium(), validateObjectIdParam('id'), productController.getSimilarProducts);

// ===== ROUTES GALLERY =====

/**
 * @route   GET /api/gallery
 * @desc    Obtenir toutes les images de la galerie avec pagination et filtres
 * @access  Public
 */
router.get('/gallery', CacheStrategies.short(), validatePagination, galleryController.getGalleryImages);

/**
 * @route   GET /api/gallery/featured
 * @desc    Obtenir les images en vedette
 * @access  Public
 */
router.get('/gallery/featured', CacheStrategies.medium(), galleryController.getFeaturedImages);

/**
 * @route   GET /api/gallery/categories
 * @desc    Obtenir les catégories d'images disponibles
 * @access  Public
 */
router.get('/gallery/categories', CacheStrategies.long(), galleryController.getCategories);

/**
 * @route   GET /api/gallery/tags
 * @desc    Obtenir tous les tags disponibles
 * @access  Public
 */
router.get('/gallery/tags', CacheStrategies.long(), galleryController.getTags);

/**
 * @route   GET /api/gallery/search
 * @desc    Rechercher des images
 * @access  Public
 */
router.get('/gallery/search', CacheStrategies.short(), validatePagination, galleryController.searchImages);

/**
 * @route   GET /api/gallery/stats
 * @desc    Obtenir les statistiques de la galerie
 * @access  Public
 */
router.get('/gallery/stats', CacheStrategies.noCache(), galleryController.getGalleryStats);

/**
 * @route   GET /api/gallery/masonry
 * @desc    Obtenir une galerie masonry (pour l'affichage en grille)
 * @access  Public
 */
router.get('/gallery/masonry', CacheStrategies.short(), galleryController.getMasonryGallery);

/**
 * @route   GET /api/gallery/category/:category
 * @desc    Obtenir les images par catégorie
 * @access  Public
 */
router.get('/gallery/category/:category', CacheStrategies.short(), validatePagination, galleryController.getImagesByCategory);

/**
 * @route   GET /api/gallery/:id
 * @desc    Obtenir une image par son ID
 * @access  Public
 */
router.get('/gallery/:id', CacheStrategies.medium(), validateObjectIdParam('id'), galleryController.getImageById);

// ===== ROUTES MESSAGES =====

/**
 * @route   POST /api/messages
 * @desc    Créer un nouveau message de contact
 * @access  Public (pas de CSRF car route publique)
 */
router.post('/messages', contactLimiter, validateMessage, messageController.createMessage);

export default router;