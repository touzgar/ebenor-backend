import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { ApiError, ERROR_CODES } from './errorHandler';
import { Product } from '../models/Product';
import { AdminUser } from '../models/AdminUser';
import { Category } from '../models/Category';

// Export body for use in route files
export { body, query, param };

// Middleware pour traiter les résultats de validation
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? (error as any).value : undefined
    }));
    
    throw new ApiError(
      'Données invalides',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      errorMessages
    );
  }
  
  next();
};

// Validations pour l'authentification
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('L\'email est requis')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email trop long (maximum 100 caractères)'),
  
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  
  handleValidationErrors
];

// Validations pour la création d'utilisateur admin
export const validateAdminUser = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('L\'email est requis')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email trop long (maximum 100 caractères)')
    .custom(async (value, { req }) => {
      const existingUser = await AdminUser.findOne({ email: value });
      // Si on est en mode update, vérifier que ce n'est pas le même utilisateur
      if (existingUser && existingUser._id.toString() !== req.params?.id) {
        throw new Error('Cet email est déjà utilisé');
      }
      return true;
    }),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'\-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'\-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets'),
  
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  
  handleValidationErrors
];

// Validations pour les produits
export const validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ min: 2, max: 200 })
    .withMessage('Le nom doit contenir entre 2 et 200 caractères')
    .matches(/^[a-zA-ZÀ-ÿ0-9\s\-'.,()]+$/)
    .withMessage('Le nom contient des caractères invalides'),
  
  body('slug')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Le slug doit contenir entre 2 et 200 caractères')
    .matches(/^[a-z0-9\-]+$/)
    .withMessage('Le slug ne peut contenir que des lettres minuscules, chiffres et tirets')
    .custom(async (value, { req }) => {
      if (value) {
        const existingProduct = await Product.findOne({ slug: value });
        // Si on est en mode update, vérifier que ce n'est pas le même produit
        if (existingProduct && existingProduct._id.toString() !== req.params?.id) {
          throw new Error('Ce slug est déjà utilisé');
        }
      }
      return true;
    }),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('La description est requise')
    .isLength({ min: 10, max: 5000 })
    .withMessage('La description doit contenir entre 10 et 5000 caractères'),
  
  body('shortDescription')
    .trim()
    .notEmpty()
    .withMessage('La description courte est requise')
    .isLength({ min: 10, max: 300 })
    .withMessage('La description courte doit contenir entre 10 et 300 caractères'),
  
  body('category')
    .notEmpty()
    .withMessage('La catégorie est requise')
    .custom(async (value) => {
      const categoryExists = await Category.findOne({ slug: value });
      if (!categoryExists) {
        throw new Error('Catégorie invalide');
      }
      return true;
    }),
  
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Sous-catégorie trop longue'),
  
  body('images')
    .optional()
    .isArray()
    .withMessage('Les images doivent être un tableau'),
  
  body('images.*.url')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('URL d\'image invalide'),
  
  body('images.*.alt')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Le texte alternatif ne peut pas dépasser 200 caractères'),
  
  body('images.*.isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary doit être un booléen'),
  
  body('specifications')
    .optional()
    .custom((value) => {
      if (value && typeof value === 'object') {
        // Vérifier que toutes les valeurs sont des chaînes
        for (const key in value) {
          if (typeof value[key] !== 'string') {
            throw new Error('Les valeurs des spécifications doivent être des chaînes');
          }
          if (value[key].length > 500) {
            throw new Error('Les valeurs des spécifications ne peuvent pas dépasser 500 caractères');
          }
        }
      }
      return true;
    }),
  
  body('dimensions.length')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('La longueur doit être entre 0 et 10000'),
  
  body('dimensions.width')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('La largeur doit être entre 0 et 10000'),
  
  body('dimensions.height')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('La hauteur doit être entre 0 et 10000'),
  
  body('dimensions.unit')
    .optional()
    .isIn(['cm', 'm'])
    .withMessage('L\'unité doit être cm ou m'),
  
  body('materials')
    .optional()
    .isArray()
    .withMessage('Les matériaux doivent être un tableau'),
  
  body('materials.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Nom de matériau invalide (1-100 caractères)'),
  
  body('finishes')
    .optional()
    .isArray()
    .withMessage('Les finitions doivent être un tableau'),
  
  body('finishes.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Nom de finition invalide (1-100 caractères)'),
  
  body('price.amount')
    .optional()
    .isFloat({ min: 0, max: 999999999 })
    .withMessage('Le prix doit être entre 0 et 999999999'),
  
  body('price.currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Code devise invalide (3 caractères)')
    .matches(/^[A-Z]{3}$/)
    .withMessage('Le code devise doit être en majuscules (ex: TND, EUR, USD)'),
  
  body('price.unit')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('L\'unité de prix ne peut pas dépasser 20 caractères'),
  
  body('availability')
    .optional()
    .isIn(['in_stock', 'made_to_order', 'out_of_stock'])
    .withMessage('Disponibilité invalide'),
  
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured doit être un booléen'),
  
  body('seoTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Le titre SEO ne peut pas dépasser 60 caractères'),
  
  body('seoDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('La description SEO ne peut pas dépasser 160 caractères'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Les tags doivent être un tableau'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag invalide (1-50 caractères)')
    .matches(/^[a-z0-9\-]+$/)
    .withMessage('Les tags ne peuvent contenir que des lettres minuscules, chiffres et tirets'),
  
  handleValidationErrors
];

// Validations pour les images de galerie
export const validateGalleryImage = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Le titre est requis')
    .isLength({ min: 2, max: 200 })
    .withMessage('Le titre doit contenir entre 2 et 200 caractères'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description trop longue (maximum 1000 caractères)'),
  
  body('category')
    .notEmpty()
    .withMessage('La catégorie est requise')
    .isIn(['cuisine', 'dressing', 'mobilier', 'amenagement', 'showroom', 'process', 'autre'])
    .withMessage('Catégorie invalide'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Les tags doivent être un tableau'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag invalide (1-50 caractères)')
    .matches(/^[a-z0-9\-]+$/)
    .withMessage('Les tags ne peuvent contenir que des lettres minuscules, chiffres et tirets'),
  
  body('alt')
    .trim()
    .notEmpty()
    .withMessage('Le texte alternatif est requis')
    .isLength({ min: 2, max: 200 })
    .withMessage('Le texte alternatif doit contenir entre 2 et 200 caractères'),
  
  body('url')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('URL d\'image invalide'),
  
  body('cloudinaryId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('ID Cloudinary invalide'),
  
  body('width')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('La largeur doit être entre 1 et 10000 pixels'),
  
  body('height')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('La hauteur doit être entre 1 et 10000 pixels'),
  
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured doit être un booléen'),
  
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('L\'ordre de tri doit être un entier positif'),
  
  handleValidationErrors
];

// Validations pour les messages de contact
export const validateMessage = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'\-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('L\'email est requis')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email trop long (maximum 100 caractères)'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro de téléphone invalide (8-20 caractères, chiffres, espaces, +, -, (, ) autorisés)'),
  
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Le sujet est requis')
    .isLength({ min: 5, max: 200 })
    .withMessage('Le sujet doit contenir entre 5 et 200 caractères'),
  
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Le message est requis')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Le message doit contenir entre 10 et 5000 caractères'),
  
  handleValidationErrors
];

// Validations pour la mise à jour du contenu home
export const validateHomeContent = [
  body('hero.title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Le titre hero doit contenir entre 5 et 200 caractères'),
  
  body('hero.subtitle')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Le sous-titre hero doit contenir entre 10 et 500 caractères'),
  
  body('hero.backgroundImage')
    .isURL()
    .withMessage('URL de l\'image de fond invalide'),
  
  body('hero.ctaText')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le texte CTA doit contenir entre 2 et 50 caractères'),
  
  body('hero.ctaLink')
    .isURL()
    .withMessage('Lien CTA invalide'),
  
  body('about.title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Le titre à propos doit contenir entre 5 et 200 caractères'),
  
  body('about.description')
    .trim()
    .isLength({ min: 50, max: 2000 })
    .withMessage('La description à propos doit contenir entre 50 et 2000 caractères'),
  
  body('about.image')
    .isURL()
    .withMessage('URL de l\'image à propos invalide'),
  
  body('about.highlights')
    .isArray({ min: 1 })
    .withMessage('Au moins un point fort est requis'),
  
  body('about.highlights.*')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Chaque point fort doit contenir entre 5 et 100 caractères'),
  
  body('services')
    .isArray({ min: 1 })
    .withMessage('Au moins un service est requis'),
  
  body('services.*.title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Le titre du service doit contenir entre 5 et 100 caractères'),
  
  body('services.*.description')
    .trim()
    .isLength({ min: 20, max: 500 })
    .withMessage('La description du service doit contenir entre 20 et 500 caractères'),
  
  body('contact.address')
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('L\'adresse doit contenir entre 10 et 300 caractères'),
  
  body('contact.phone')
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro de téléphone invalide'),
  
  body('contact.email')
    .isEmail()
    .withMessage('Email de contact invalide'),
  
  body('contact.whatsapp')
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro WhatsApp invalide'),
  
  handleValidationErrors
];

// Validations pour les paramètres de requête
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
  
  query('sort')
    .optional()
    .isIn([
      'createdAt', '-createdAt',
      'name', '-name',
      'price', '-price',
      'featured', '-featured',
      // Gallery-specific sorts accepted by galleryController
      'date', 'date:1', 'date:-1',
      'title', 'title:1', 'title:-1',
      'uploadedAt', '-uploadedAt'
    ])
    .withMessage('Critère de tri invalide'),
  
  handleValidationErrors
];

// Validations pour les filtres de produits
export const validateProductFilters = [
  query('category')
    .optional()
    .custom(async (value) => {
      if (value) {
        const categoryExists = await Category.findOne({ slug: value });
        if (!categoryExists) {
          throw new Error('Catégorie invalide');
        }
      }
      return true;
    }),
  
  query('subcategory')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Sous-catégorie invalide'),
  
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured doit être un booléen'),
  
  query('availability')
    .optional()
    .isIn(['in_stock', 'made_to_order', 'out_of_stock'])
    .withMessage('Disponibilité invalide'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('La recherche doit contenir entre 1 et 100 caractères'),
  
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prix minimum invalide'),
  
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prix maximum invalide'),
  
  handleValidationErrors
];

// Validation des paramètres ObjectId
export const validateObjectIdParam = (paramName: string = 'id') => [
  param(paramName)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('ID invalide'),
  
  handleValidationErrors
];

// Validations pour les opérations en masse
export const validateBulkOperation = [
  body('operation')
    .notEmpty()
    .withMessage('L\'opération est requise')
    .isIn(['delete', 'feature', 'unfeature', 'changeCategory', 'changeStatus'])
    .withMessage('Opération invalide'),
  
  body('ids')
    .isArray({ min: 1 })
    .withMessage('Au moins un ID est requis'),
  
  body('ids.*')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('ID invalide dans la liste'),
  
  body('category')
    .if(body('operation').equals('changeCategory'))
    .notEmpty()
    .withMessage('La catégorie est requise pour cette opération')
    .custom(async (value) => {
      const categoryExists = await Category.findOne({ slug: value });
      if (!categoryExists) {
        throw new Error('Catégorie invalide');
      }
      return true;
    }),
  
  body('status')
    .if(body('operation').equals('changeStatus'))
    .notEmpty()
    .withMessage('Le statut est requis pour cette opération')
    .isIn(['in_stock', 'made_to_order', 'out_of_stock'])
    .withMessage('Statut invalide'),
  
  handleValidationErrors
];

// Validations pour la mise à jour de l'ordre de tri
export const validateSortOrder = [
  body('images')
    .isArray({ min: 1 })
    .withMessage('Au moins une image est requise'),
  
  body('images.*.id')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('ID d\'image invalide'),
  
  body('images.*.sortOrder')
    .isInt({ min: 0 })
    .withMessage('L\'ordre de tri doit être un entier positif'),
  
  handleValidationErrors
];


// Validations pour les filtres de messages
export const validateMessageFilters = [
  query('status')
    .optional()
    .isIn(['new', 'read', 'replied', 'archived'])
    .withMessage('Statut invalide'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priorité invalide'),
  
  query('source')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Source invalide'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('La recherche doit contenir entre 1 et 100 caractères'),
  
  handleValidationErrors
];

// Validation pour changer la priorité d'un message
export const validatePriority = [
  body('priority')
    .notEmpty()
    .withMessage('La priorité est requise')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priorité invalide (low, medium, high)'),
  
  handleValidationErrors
];

// Validation pour ajouter une note
export const validateNote = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Le texte de la note est requis')
    .isLength({ min: 1, max: 2000 })
    .withMessage('La note doit contenir entre 1 et 2000 caractères'),
  
  handleValidationErrors
];
