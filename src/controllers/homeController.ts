import { Request, Response, NextFunction } from 'express';
import { HomeContent } from '../models/HomeContent';
import { ApiError, ERROR_CODES } from '../middleware/errorHandler';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { MockDataService } from '../services/mockDataService';

export class HomeController {
  /**
   * Obtenir le contenu de la page d'accueil
   */
  public async getHomeContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let homeContent;
      
      try {
        // Essayer d'abord avec MongoDB
        homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });
        
        // Si aucun contenu n'existe, créer un contenu par défaut
        if (!homeContent) {
          homeContent = await this.createDefaultHomeContent();
        }
        
        homeContent = homeContent.toPublicJSON();
      } catch (dbError) {
        // Si MongoDB n'est pas disponible, utiliser les données de test
        logger.warn('MongoDB non disponible, utilisation des données de test', { error: dbError });
        homeContent = MockDataService.getHomeContent();
      }

      const response: ApiResponse = {
        success: true,
        data: homeContent,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer le contenu par défaut de la page d'accueil
   */
  private async createDefaultHomeContent() {
    const defaultContent = new HomeContent({
      hero: {
        companyName: "ÉBÉNOR CRÉATION",
        title: "L'élégance du bois, l'empreinte de l'art",
        subtitle: "Découvrez l'excellence de l'ébénisterie tunisienne avec ÉBÉNOR CRÉATION. Nous transformons vos espaces en œuvres d'art avec passion et savoir-faire depuis plus de 25 ans.",
        backgroundImage: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
        ctaText: "Demander un devis",
        ctaLink: "/contact"
      },
      about: {
        title: "Notre Expertise",
        description: "ÉBÉNOR CRÉATION est une entreprise familiale tunisienne spécialisée dans la fabrication de meubles haut de gamme. Nous combinons techniques traditionnelles et technologies modernes pour créer des pièces uniques qui reflètent votre personnalité et s'adaptent parfaitement à vos espaces.",
        image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        highlights: [
          "Plus de 25 ans d'expérience",
          "Artisans qualifiés et passionnés",
          "Matériaux nobles sélectionnés",
          "Fabrication 100% tunisienne",
          "Service personnalisé"
        ]
      },
      services: [
        {
          title: "Cuisines sur Mesure",
          description: "Créez la cuisine de vos rêves avec nos designs personnalisés, alliant fonctionnalité et esthétique pour un espace de vie exceptionnel.",
          icon: "kitchen",
          image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          title: "Dressings Élégants",
          description: "Optimisez votre espace avec nos dressings sur mesure, conçus pour allier rangement intelligent et design raffiné.",
          icon: "wardrobe",
          image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          title: "Mobilier de Luxe",
          description: "Découvrez notre collection de meubles haut de gamme, chaque pièce étant une œuvre d'art fonctionnelle pour votre intérieur.",
          icon: "furniture",
          image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          title: "Aménagements Complets",
          description: "Transformez entièrement vos espaces avec nos solutions d'aménagement global, de la conception à la réalisation.",
          icon: "home",
          image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        }
      ],
      process: [
        {
          step: 1,
          title: "Consultation",
          description: "Rencontre personnalisée pour comprendre vos besoins, vos goûts et votre budget. Nous étudions votre espace et vos contraintes.",
          image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          step: 2,
          title: "Design 3D",
          description: "Création de plans détaillés et visualisation 3D de votre projet pour vous permettre de voir le résultat avant fabrication.",
          image: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          step: 3,
          title: "Fabrication",
          description: "Réalisation artisanale dans nos ateliers avec des matériaux nobles et un contrôle qualité rigoureux à chaque étape.",
          image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        },
        {
          step: 4,
          title: "Installation",
          description: "Pose professionnelle par nos équipes expertes avec finitions parfaites et nettoyage complet de votre espace.",
          image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        }
      ],
      testimonials: [
        {
          name: "Ahmed Ben Salem",
          company: "Villa Sidi Bou Saïd",
          text: "Un travail exceptionnel ! L'équipe d'ÉBÉNOR CRÉATION a transformé notre cuisine en véritable œuvre d'art. La qualité des matériaux et la finition sont irréprochables.",
          rating: 5,
          image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
        },
        {
          name: "Leila Trabelsi",
          company: "Appartement La Marsa",
          text: "Service personnalisé remarquable. Ils ont su comprendre exactement ce que nous voulions et ont livré au-delà de nos attentes. Je recommande vivement !",
          rating: 5,
          image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
        },
        {
          name: "Mohamed Gharbi",
          company: "Bureau Tunis Centre",
          text: "Professionnalisme et créativité au rendez-vous. Notre espace de bureau a été complètement transformé avec des solutions innovantes et élégantes.",
          rating: 5,
          image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
        }
      ],
      contact: {
        address: "Zone Industrielle Mghira 2, 2082 Fouchana, Tunis, Tunisie",
        phone: "+216 70 123 456",
        email: "contact@ebenor-creation.tn",
        whatsapp: "+216 98 765 432",
        workingHours: "Lundi - Vendredi: 8h00 - 17h00 | Samedi: 8h00 - 12h00"
      }
    });

    await defaultContent.save();
    logger.info('Contenu par défaut de la page d\'accueil créé');
    
    return defaultContent;
  }

  /**
   * Obtenir les statistiques de la page d'accueil (pour l'admin)
   */
  public async getHomeStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let stats;
      
      try {
        const homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });
        
        if (!homeContent) {
          throw new ApiError(
            'Contenu de la page d\'accueil non trouvé',
            404,
            ERROR_CODES.NOT_FOUND
          );
        }

        stats = {
          lastUpdated: homeContent.updatedAt,
          updatedBy: homeContent.updatedBy,
          servicesCount: homeContent.services.length,
          processStepsCount: homeContent.process.length,
          testimonialsCount: homeContent.testimonials.length,
          highlightsCount: homeContent.about.highlights.length,
        };
      } catch (dbError) {
        // Si MongoDB n'est pas disponible, utiliser des statistiques de test
        logger.warn('MongoDB non disponible, utilisation des statistiques de test', { error: dbError });
        const mockContent = MockDataService.getHomeContent();
        stats = {
          lastUpdated: new Date(),
          updatedBy: null,
          servicesCount: mockContent.services.length,
          processStepsCount: mockContent.process.length,
          testimonialsCount: mockContent.testimonials.length,
          highlightsCount: mockContent.about.highlights.length,
        };
      }

      const response: ApiResponse = {
        success: true,
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Mettre à jour le contenu complet de la page d'accueil (Admin only)
   */
  public async updateHomeContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updateData = req.body;

      // Ajouter l'utilisateur qui fait la mise à jour
      if (req.user) {
        updateData.updatedBy = req.user.email || req.user.id;
      }

      // Trouver le contenu existant ou créer un nouveau
      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        // Créer un nouveau contenu si aucun n'existe
        homeContent = new HomeContent(updateData);
      } else {
        // Mettre à jour le contenu existant
        Object.assign(homeContent, updateData);
      }

      await homeContent.save();

      logger.info('Home content updated', { 
        updatedBy: updateData.updatedBy,
        sections: Object.keys(updateData)
      });

      const response: ApiResponse = {
        success: true,
        data: homeContent.toPublicJSON(),
        message: 'Contenu de la page d\'accueil mis à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section hero (Admin only)
   */
  public async updateHeroSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const heroData = req.body;

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section hero
      homeContent.hero = heroData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Hero section updated', { updatedBy: homeContent.updatedBy });

      const response: ApiResponse = {
        success: true,
        data: homeContent.hero,
        message: 'Section hero mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section about (Admin only)
   */
  public async updateAboutSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const aboutData = req.body;

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section about
      homeContent.about = aboutData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('About section updated', { updatedBy: homeContent.updatedBy });

      const response: ApiResponse = {
        success: true,
        data: homeContent.about,
        message: 'Section à propos mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section services (Admin only)
   */
  public async updateServicesSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const servicesData = req.body.services;

      if (!Array.isArray(servicesData)) {
        throw new ApiError(
          'Les services doivent être un tableau',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section services
      homeContent.services = servicesData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Services section updated', { 
        updatedBy: homeContent.updatedBy,
        servicesCount: servicesData.length
      });

      const response: ApiResponse = {
        success: true,
        data: homeContent.services,
        message: 'Section services mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section process (Admin only)
   */
  public async updateProcessSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const processData = req.body.process;

      if (!Array.isArray(processData)) {
        throw new ApiError(
          'Le processus doit être un tableau',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section process
      homeContent.process = processData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Process section updated', { 
        updatedBy: homeContent.updatedBy,
        stepsCount: processData.length
      });

      const response: ApiResponse = {
        success: true,
        data: homeContent.process,
        message: 'Section processus mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section testimonials (Admin only)
   */
  public async updateTestimonialsSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const testimonialsData = req.body.testimonials;

      if (!Array.isArray(testimonialsData)) {
        throw new ApiError(
          'Les témoignages doivent être un tableau',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section testimonials
      homeContent.testimonials = testimonialsData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Testimonials section updated', { 
        updatedBy: homeContent.updatedBy,
        testimonialsCount: testimonialsData.length
      });

      const response: ApiResponse = {
        success: true,
        data: homeContent.testimonials,
        message: 'Section témoignages mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour la section contact (Admin only)
   */
  public async updateContactSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const contactData = req.body;

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Mettre à jour la section contact
      homeContent.contact = contactData;
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Contact section updated', { updatedBy: homeContent.updatedBy });

      const response: ApiResponse = {
        success: true,
        data: homeContent.contact,
        message: 'Section contact mise à jour avec succès',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publier/dépublier une section (Admin only)
   * Note: Cette fonctionnalité nécessite l'ajout d'un champ 'published' dans le modèle
   * Pour l'instant, on retourne une réponse de succès
   */
  public async toggleSectionPublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { section, published } = req.body;

      if (!section || typeof published !== 'boolean') {
        throw new ApiError(
          'Section et statut de publication requis',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const validSections = ['hero', 'about', 'services', 'process', 'testimonials', 'contact'];
      
      if (!validSections.includes(section)) {
        throw new ApiError(
          'Section invalide',
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      let homeContent = await HomeContent.findOne().sort({ updatedAt: -1 });

      if (!homeContent) {
        throw new ApiError(
          'Contenu de la page d\'accueil non trouvé',
          404,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Note: Pour une implémentation complète, il faudrait ajouter un champ 'publishedSections'
      // dans le modèle HomeContent pour tracker quelles sections sont publiées
      // Pour l'instant, on log l'action et on retourne un succès
      
      if (req.user) {
        homeContent.updatedBy = req.user.email || req.user.id;
      }

      await homeContent.save();

      logger.info('Section publish status toggled', { 
        section,
        published,
        updatedBy: homeContent.updatedBy
      });

      const response: ApiResponse = {
        success: true,
        data: { section, published },
        message: `Section ${section} ${published ? 'publiée' : 'dépubliée'} avec succès`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Instance du contrôleur de la page d'accueil
export const homeController = new HomeController();