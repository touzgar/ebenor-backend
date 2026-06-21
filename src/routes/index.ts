import { Router } from 'express';
import authRoutes from './auth';
import publicRoutes from './public';
import adminRoutes from './admin';
import healthRoutes from './health';
import showroomRoutes from './showroom';

const router = Router();

// Health check route
router.use('/health', healthRoutes);

// Routes d'authentification
router.use('/auth', authRoutes);

// Showroom content route
router.use('/showroom', showroomRoutes);

// Routes publiques
router.use('/', publicRoutes);

// Routes admin (protégées par authentification)
router.use('/admin', adminRoutes);

// Route de test pour vérifier que l'API fonctionne
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API ÉBENOR CRÉATION fonctionne correctement',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Route d'information sur l'API
router.get('/', (req, res) => {
  res.json({
    message: 'API ÉBENOR CRÉATION - Routes publiques et authentification implémentées',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /auth/login': 'Connexion administrateur',
        'POST /auth/logout': 'Déconnexion',
        'POST /auth/refresh-token': 'Rafraîchir le token',
        'GET /auth/profile': 'Profil utilisateur',
        'PUT /auth/profile': 'Mettre à jour le profil',
        'POST /auth/change-password': 'Changer le mot de passe',
        'POST /auth/request-password-reset': 'Demander réinitialisation',
        'POST /auth/reset-password': 'Réinitialiser le mot de passe',
        'POST /auth/verify-token': 'Vérifier un token',
        'GET /auth/permissions': 'Obtenir les permissions',
      },
      public: {
        'GET /home': 'Contenu page d\'accueil',
        'GET /products': 'Liste des produits',
        'GET /products/featured': 'Produits en vedette',
        'GET /products/categories': 'Catégories de produits',
        'GET /products/search': 'Recherche de produits',
        'GET /gallery': 'Images de la galerie',
        'GET /gallery/featured': 'Images en vedette',
        'GET /gallery/masonry': 'Galerie masonry',
        'POST /messages': 'Envoyer un message de contact',
      },
      admin: {
        products: {
          'GET /admin/products': 'Liste des produits (admin)',
          'POST /admin/products': 'Créer un produit',
          'PUT /admin/products/:id': 'Mettre à jour un produit',
          'DELETE /admin/products/:id': 'Supprimer un produit',
          'POST /admin/products/bulk': 'Opérations en masse',
          'GET /admin/products/:id': 'Obtenir un produit pour édition',
        },
        gallery: {
          'POST /admin/gallery': 'Créer une image de galerie',
          'PUT /admin/gallery/:id': 'Mettre à jour une image',
          'DELETE /admin/gallery/:id': 'Supprimer une image',
          'POST /admin/gallery/bulk': 'Opérations en masse',
          'PUT /admin/gallery/sort-order': 'Mettre à jour l\'ordre',
          'GET /admin/gallery/:id': 'Obtenir une image pour édition',
        },
        home: {
          'GET /admin/home': 'Obtenir le contenu de la page d\'accueil',
          'PUT /admin/home': 'Mettre à jour le contenu complet',
          'PUT /admin/home/hero': 'Mettre à jour la section hero',
          'PUT /admin/home/about': 'Mettre à jour la section about',
          'PUT /admin/home/services': 'Mettre à jour la section services',
          'PUT /admin/home/process': 'Mettre à jour la section process',
          'PUT /admin/home/testimonials': 'Mettre à jour la section testimonials',
          'PUT /admin/home/contact': 'Mettre à jour la section contact',
          'POST /admin/home/publish': 'Publier/dépublier une section',
        },
      },
    },
  });
});

export default router;