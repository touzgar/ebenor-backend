import mongoose, { Schema, Model } from 'mongoose';
import { GalleryImage as IGalleryImage } from '../types';

// Omit _id from IGalleryImage to avoid conflicts with Mongoose's _id
type GalleryImageBase = Omit<IGalleryImage, '_id'>;

export interface GalleryImageDocument extends GalleryImageBase, mongoose.Document {
  toPublicJSON(): any;
  getAspectRatio(): number;
  isLandscape(): boolean;
  isPortrait(): boolean;
  isSquare(): boolean;
}

const GalleryImageSchema = new Schema<GalleryImageDocument>({
  title: { 
    type: String, 
    required: true, 
    maxlength: 200,
    trim: true
  },
  description: { 
    type: String, 
    maxlength: 1000,
    trim: true
  },
  url: { 
    type: String, 
    required: true 
  },
  thumbnailUrl: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true,
    enum: ['cuisine', 'dressing', 'mobilier', 'amenagement', 'showroom', 'process', 'product', 'autre'],
    lowercase: true
  },
  tags: [{ 
    type: String, 
    maxlength: 50,
    lowercase: true,
    trim: true
  }],
  alt: { 
    type: String, 
    required: true, 
    maxlength: 200,
    trim: true
  },
  dimensions: {
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 }
  },
  fileSize: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  mimeType: { 
    type: String, 
    required: true,
    enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  },
  featured: { 
    type: Boolean, 
    default: false 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  },
  createdBy: { 
    type: String
  },
  updatedBy: { 
    type: String 
  }
}, {
  timestamps: { createdAt: 'uploadedAt', updatedAt: true },
  collection: 'gallery_images'
});

// Index pour optimiser les requêtes
// Requirement 29.6: Compound index on category and sortOrder fields
GalleryImageSchema.index({ category: 1, sortOrder: 1 });

// Requirement 29.7: Compound index on featured and uploadedAt fields
GalleryImageSchema.index({ featured: -1, uploadedAt: -1 });

// Requirement 29.4: Index on tags field for array queries
GalleryImageSchema.index({ tags: 1 });

// Additional indexes for common query patterns
GalleryImageSchema.index({ category: 1, featured: -1 }); // Featured images by category
GalleryImageSchema.index({ uploadedAt: -1 }); // Recent images
GalleryImageSchema.index({ sortOrder: 1 }); // Sorting

// Requirement 29.8: Text index on title, description, tags, and alt fields
GalleryImageSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
  alt: 'text'
}, {
  weights: {
    title: 10,
    tags: 5,
    alt: 3,
    description: 1
  },
  name: 'gallery_text_search'
});

// Méthodes personnalisées
GalleryImageSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.createdBy;
  delete obj.updatedBy;
  return obj;
};

GalleryImageSchema.methods.getAspectRatio = function() {
  return this.dimensions.width / this.dimensions.height;
};

GalleryImageSchema.methods.isLandscape = function() {
  return this.dimensions.width > this.dimensions.height;
};

GalleryImageSchema.methods.isPortrait = function() {
  return this.dimensions.height > this.dimensions.width;
};

GalleryImageSchema.methods.isSquare = function() {
  return this.dimensions.width === this.dimensions.height;
};

// Méthodes statiques
GalleryImageSchema.statics.getFeaturedImages = function(limit = 10) {
  return this.find({ featured: true })
    .sort({ sortOrder: 1, uploadedAt: -1 })
    .limit(limit);
};

GalleryImageSchema.statics.getByCategory = function(category: string, limit = 20) {
  return this.find({ category })
    .sort({ sortOrder: 1, uploadedAt: -1 })
    .limit(limit);
};

// Middleware pre-save
GalleryImageSchema.pre('save', function(next) {
  // Générer alt text si pas fourni
  if (!this.alt && this.title) {
    this.alt = `Image de ${this.title} - ÉBÉNOR CRÉATION`;
  }

  // Valider les dimensions
  if (this.dimensions.width <= 0 || this.dimensions.height <= 0) {
    return next(new Error('Les dimensions de l\'image doivent être positives'));
  }

  // Valider la taille du fichier (max 10MB)
  if (this.fileSize > 10 * 1024 * 1024) {
    return next(new Error('La taille du fichier ne peut pas dépasser 10MB'));
  }

  next();
});

// Middleware post-save pour logging
GalleryImageSchema.post('save', function(doc) {
  console.log(`Image sauvegardée: ${doc.title} (${doc.category})`);
});

// Middleware pre-remove pour nettoyage
GalleryImageSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  console.log(`Suppression de l'image: ${this.title}`);
  // Ici on pourrait ajouter la logique pour supprimer l'image de Cloudinary
  next();
});

export const GalleryImage = (mongoose.models.GalleryImage as Model<GalleryImageDocument>) || mongoose.model<GalleryImageDocument>('GalleryImage', GalleryImageSchema);