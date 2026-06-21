import { Router } from 'express';
import { homeController } from '../../controllers/homeController';
import { authenticate } from '../../middleware/auth';
import { 
  validateHomeContent,
  body,
  handleValidationErrors
} from '../../middleware/validation';

const router = Router();

// Toutes les routes admin nécessitent une authentification
router.use(authenticate);

/**
 * @route   PUT /api/admin/home
 * @desc    Mettre à jour le contenu complet de la page d'accueil
 * @access  Admin
 */
router.put('/', validateHomeContent, homeController.updateHomeContent.bind(homeController));

/**
 * @route   PUT /api/admin/home/hero
 * @desc    Mettre à jour la section hero
 * @access  Admin
 */
router.put('/hero', [
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom de l\'entreprise doit contenir entre 2 et 100 caractères'),
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Le titre hero doit contenir entre 5 et 200 caractères'),
  body('subtitle')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Le sous-titre hero doit contenir entre 10 et 500 caractères'),
  body('backgroundImage')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      // Check if it's a valid URL
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(value)) {
        throw new Error('L\'image de fond doit être une URL valide');
      }
      return true;
    }),
  body('videoUrl')
    .optional()
    .trim(),
  body('ctaText')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le texte CTA doit contenir entre 2 et 50 caractères'),
  body('ctaLink')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Le lien CTA est requis')
    .custom((value) => {
      // Allow relative paths starting with /
      if (value.startsWith('/')) {
        return true;
      }
      // Allow full URLs (http:// or https://)
      const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
      if (!urlPattern.test(value)) {
        throw new Error('Le lien doit être une URL valide ou un chemin relatif (ex: /contact ou https://example.com)');
      }
      return true;
    }),
  handleValidationErrors
], homeController.updateHeroSection.bind(homeController));

/**
 * @route   PUT /api/admin/home/about
 * @desc    Mettre à jour la section about
 * @access  Admin
 */
router.put('/about', [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Le titre à propos doit contenir entre 5 et 200 caractères'),
  body('description')
    .trim()
    .isLength({ min: 50, max: 2000 })
    .withMessage('La description à propos doit contenir entre 50 et 2000 caractères'),
  body('image')
    .isURL()
    .withMessage('URL de l\'image à propos invalide'),
  body('highlights')
    .isArray({ min: 1 })
    .withMessage('Au moins un point fort est requis'),
  body('highlights.*')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Chaque point fort doit contenir entre 5 et 100 caractères'),
  handleValidationErrors
], homeController.updateAboutSection.bind(homeController));

/**
 * @route   PUT /api/admin/home/services
 * @desc    Mettre à jour la section services
 * @access  Admin
 */
router.put('/services', [
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
  body('services.*.icon')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('L\'icône du service est requise'),
  body('services.*.image')
    .optional()
    .isURL()
    .withMessage('URL de l\'image du service invalide'),
  handleValidationErrors
], homeController.updateServicesSection.bind(homeController));

/**
 * @route   PUT /api/admin/home/process
 * @desc    Mettre à jour la section process
 * @access  Admin
 */
router.put('/process', [
  body('process')
    .isArray({ min: 1 })
    .withMessage('Au moins une étape de processus est requise'),
  body('process.*.step')
    .isInt({ min: 1 })
    .withMessage('Le numéro d\'étape doit être un entier positif'),
  body('process.*.title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Le titre de l\'étape doit contenir entre 5 et 100 caractères'),
  body('process.*.description')
    .trim()
    .isLength({ min: 20, max: 500 })
    .withMessage('La description de l\'étape doit contenir entre 20 et 500 caractères'),
  body('process.*.image')
    .isURL()
    .withMessage('URL de l\'image de l\'étape invalide'),
  handleValidationErrors
], homeController.updateProcessSection.bind(homeController));

/**
 * @route   PUT /api/admin/home/testimonials
 * @desc    Mettre à jour la section testimonials
 * @access  Admin
 */
router.put('/testimonials', [
  body('testimonials')
    .isArray()
    .withMessage('Les témoignages doivent être un tableau'),
  body('testimonials.*.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
  body('testimonials.*.company')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('L\'entreprise doit contenir entre 2 et 100 caractères'),
  body('testimonials.*.text')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Le texte doit contenir entre 10 et 1000 caractères'),
  body('testimonials.*.rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('La note doit être entre 1 et 5'),
  body('testimonials.*.image')
    .optional()
    .isURL()
    .withMessage('URL de l\'image invalide'),
  handleValidationErrors
], homeController.updateTestimonialsSection.bind(homeController));

/**
 * @route   PUT /api/admin/home/contact
 * @desc    Mettre à jour la section contact
 * @access  Admin
 */
router.put('/contact', [
  body('address')
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('L\'adresse doit contenir entre 10 et 300 caractères'),
  body('phone')
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro de téléphone invalide'),
  body('email')
    .isEmail()
    .withMessage('Email de contact invalide'),
  body('whatsapp')
    .matches(/^[\+]?[0-9\s\-\(\)]{8,20}$/)
    .withMessage('Numéro WhatsApp invalide'),
  body('workingHours')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Les horaires doivent contenir entre 5 et 200 caractères'),
  handleValidationErrors
], homeController.updateContactSection.bind(homeController));

/**
 * @route   POST /api/admin/home/publish
 * @desc    Publier/dépublier une section
 * @access  Admin
 */
router.post('/publish', [
  body('section')
    .isIn(['hero', 'about', 'services', 'process', 'testimonials', 'contact'])
    .withMessage('Section invalide'),
  body('published')
    .isBoolean()
    .withMessage('Le statut de publication doit être un booléen'),
  handleValidationErrors
], homeController.toggleSectionPublish.bind(homeController));

/**
 * @route   GET /api/admin/home
 * @desc    Obtenir le contenu de la page d'accueil pour édition
 * @access  Admin
 */
router.get('/', homeController.getHomeContent.bind(homeController));

export default router;
