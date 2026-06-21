import { HomeContent, Product, GalleryImage, Message } from '../types';

/**
 * Service de données de test pour le développement sans MongoDB
 */
export class MockDataService {
  
  /**
   * Données de test pour le contenu de la page d'accueil
   */
  public static getHomeContent(): HomeContent {
    return {
      hero: {
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
    };
  }

  /**
   * Données de test pour les produits
   */
  public static getProducts(): Product[] {
    return [
      {
        _id: "1",
        name: "Cuisine Moderne Chêne",
        slug: "cuisine-moderne-chene",
        description: "Une cuisine moderne en chêne massif avec îlot central et finitions haut de gamme. Design épuré et fonctionnel pour un espace de vie convivial.",
        shortDescription: "Cuisine moderne en chêne massif avec îlot central",
        category: "cuisine",
        images: [
          {
            url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            alt: "Cuisine moderne en chêne",
            isPrimary: true
          }
        ],
        specifications: {
          "Matériau": "Chêne massif",
          "Finition": "Vernis mat",
          "Style": "Moderne",
          "Garantie": "10 ans"
        },
        materials: ["Chêne massif", "Quartz", "Inox"],
        finishes: ["Vernis mat", "Laque brillante"],
        price: {
          amount: 15000,
          currency: "TND",
          unit: "ensemble"
        },
        availability: "made_to_order",
        featured: true,
        tags: ["moderne", "chêne", "îlot", "haut-de-gamme"],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: "2",
        name: "Dressing Walk-in Luxe",
        slug: "dressing-walk-in-luxe",
        description: "Dressing walk-in sur mesure avec éclairage LED intégré, miroirs et rangements optimisés. Parfait pour les grandes chambres parentales.",
        shortDescription: "Dressing walk-in avec éclairage LED intégré",
        category: "dressing",
        images: [
          {
            url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            alt: "Dressing walk-in luxe",
            isPrimary: true
          }
        ],
        specifications: {
          "Matériau": "MDF laqué",
          "Éclairage": "LED intégré",
          "Miroirs": "Inclus",
          "Garantie": "5 ans"
        },
        materials: ["MDF", "Verre", "Aluminium"],
        finishes: ["Laque mate", "Laque brillante"],
        price: {
          amount: 8500,
          currency: "TND",
          unit: "ensemble"
        },
        availability: "made_to_order",
        featured: true,
        tags: ["dressing", "walk-in", "LED", "luxe"],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  /**
   * Données de test pour la galerie
   */
  public static getGalleryImages(): GalleryImage[] {
    return [
      {
        _id: "1",
        title: "Cuisine Contemporaine",
        description: "Réalisation d'une cuisine contemporaine avec îlot central",
        url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        category: "cuisine",
        tags: ["moderne", "îlot", "contemporain"],
        alt: "Cuisine contemporaine avec îlot central",
        dimensions: {
          width: 1200,
          height: 800
        },
        fileSize: 245760,
        mimeType: "image/jpeg",
        featured: true,
        sortOrder: 1,
        uploadedAt: new Date()
      },
      {
        _id: "2",
        title: "Dressing Sur Mesure",
        description: "Dressing personnalisé avec rangements optimisés",
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        thumbnailUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        category: "dressing",
        tags: ["sur-mesure", "rangement", "optimisé"],
        alt: "Dressing sur mesure avec rangements",
        dimensions: {
          width: 1000,
          height: 1200
        },
        fileSize: 198432,
        mimeType: "image/jpeg",
        featured: true,
        sortOrder: 2,
        uploadedAt: new Date()
      }
    ];
  }
}

export const mockDataService = new MockDataService();