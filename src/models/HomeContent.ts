import mongoose, { Schema, Model } from 'mongoose';
import { HomeContent as IHomeContent } from '../types';

// Omit _id from IHomeContent to avoid conflicts with Mongoose's _id
type HomeContentBase = Omit<IHomeContent, '_id'>;

export interface HomeContentDocument extends HomeContentBase, mongoose.Document {
  toPublicJSON(): any;
}

const HomeContentSchema = new Schema<HomeContentDocument>({
  hero: {
    companyName: { type: String, maxlength: 100 },
    title: { type: String, required: true, maxlength: 200 },
    subtitle: { type: String, required: true, maxlength: 500 },
    backgroundImage: { type: String },
    videoUrl: { type: String },
    ctaText: { type: String, required: true, maxlength: 50 },
    ctaLink: { type: String, required: true }
  },
  about: {
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    image: { type: String, required: true },
    highlights: [{ type: String, maxlength: 100 }]
  },
  services: [{
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    icon: { type: String, required: true },
    image: { type: String }
  }],
  process: [{
    step: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    image: { type: String, required: true }
  }],
  testimonials: [{
    name: { type: String, required: true, maxlength: 100 },
    company: { type: String, required: true, maxlength: 100 },
    text: { type: String, required: true, maxlength: 1000 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    image: { type: String }
  }],
  contact: {
    address: { type: String, required: true, maxlength: 300 },
    phone: { type: String, required: true, maxlength: 20 },
    email: { type: String, required: true, maxlength: 100 },
    whatsapp: { type: String, required: true, maxlength: 20 },
    workingHours: { type: String, required: true, maxlength: 200 }
  },
  createdBy: { 
    type: String 
  },
  updatedBy: { 
    type: String
  }
}, {
  timestamps: true,
  collection: 'home_content'
});

// Index pour optimiser les requêtes
HomeContentSchema.index({ updatedAt: -1 });

// Méthodes personnalisées
HomeContentSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Validation personnalisée
HomeContentSchema.pre('save', function(next) {
  // Valider que les étapes du processus sont séquentielles
  if (this.process && this.process.length > 0) {
    const steps = this.process.map(p => p.step).sort((a, b) => a - b);
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] !== i + 1) {
        return next(new Error('Les étapes du processus doivent être séquentielles à partir de 1'));
      }
    }
  }
  next();
});

export const HomeContent = (mongoose.models.HomeContent as Model<HomeContentDocument>) || mongoose.model<HomeContentDocument>('HomeContent', HomeContentSchema);