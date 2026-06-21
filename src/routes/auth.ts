import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate, requireActiveAccount } from '../middleware/auth';
import { authLimiter } from '../middleware/security';
import { getCsrfToken } from '../middleware/csrf';
import { 
  validateLogin,
  handleValidationErrors 
} from '../middleware/validation';
import { body } from 'express-validator';

const router = Router();

// Validation pour la réinitialisation de mot de passe
const validatePasswordReset = [
  body('email')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  handleValidationErrors
];

// Validation pour le nouveau mot de passe
const validateNewPassword = [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  handleValidationErrors
];

// Validation pour le changement de mot de passe
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mot de passe actuel requis'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
  handleValidationErrors
];

// Validation pour la mise à jour du profil
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, apostrophes et tirets'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, apostrophes et tirets'),
  
  body('avatar')
    .optional()
    .isURL()
    .withMessage('URL d\'avatar invalide'),
  
  handleValidationErrors
];

// Validation pour la vérification de token
const validateTokenVerification = [
  body('token')
    .notEmpty()
    .withMessage('Token requis'),
  handleValidationErrors
];

// Routes publiques (sans authentification)

/**
 * @route   GET /api/auth/csrf-token
 * @desc    Obtenir un token CSRF pour les requêtes authentifiées
 * @access  Public
 */
router.get('/csrf-token', getCsrfToken);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion d'un utilisateur administrateur
 * @access  Public
 */
router.post('/login', authLimiter, validateLogin, authController.login);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Demander une réinitialisation de mot de passe
 * @access  Public
 */
router.post('/request-password-reset', authLimiter, validatePasswordReset, authController.requestPasswordReset);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialiser le mot de passe avec un token
 * @access  Public
 */
router.post('/reset-password', authLimiter, [
  body('token').notEmpty().withMessage('Token requis'),
  ...validateNewPassword
], authController.resetPassword);

/**
 * @route   POST /api/auth/verify-token
 * @desc    Vérifier la validité d'un token
 * @access  Public
 */
router.post('/verify-token', validateTokenVerification, authController.verifyToken);

// Routes protégées (authentification requise)

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Rafraîchir le token d'authentification
 * @access  Private
 */
router.post('/refresh-token', authenticate, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion d'un utilisateur
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtenir le profil de l'utilisateur connecté
 * @access  Private
 */
router.get('/profile', authenticate, requireActiveAccount, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Mettre à jour le profil de l'utilisateur connecté
 * @access  Private
 */
router.put('/profile', authenticate, requireActiveAccount, validateProfileUpdate, authController.updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Changer le mot de passe de l'utilisateur connecté
 * @access  Private
 */
router.post('/change-password', authenticate, requireActiveAccount, validateChangePassword, authController.changePassword);

/**
 * @route   GET /api/auth/permissions
 * @desc    Obtenir les permissions de l'utilisateur connecté
 * @access  Private
 */
router.get('/permissions', authenticate, requireActiveAccount, authController.getPermissions);

export default router;