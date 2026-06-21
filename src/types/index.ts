import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// Types pour l'authentification
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface JWTPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore?: boolean;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Types pour les modèles de données
export interface HomeContent {
  _id?: string;
  hero: {
    companyName?: string;
    title: string;
    subtitle: string;
    backgroundImage?: string;
    videoUrl?: string;
    ctaText: string;
    ctaLink: string;
  };
  about: {
    title: string;
    description: string;
    image: string;
    highlights: string[];
  };
  services: Array<{
    title: string;
    description: string;
    icon: string;
    image?: string;
  }>;
  process: Array<{
    step: number;
    title: string;
    description: string;
    image: string;
  }>;
  testimonials: Array<{
    name: string;
    company: string;
    text: string;
    rating: number;
    image?: string;
  }>;
  contact: {
    address: string;
    phone: string;
    email: string;
    whatsapp: string;
    workingHours: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface Product {
  _id?: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  images: Array<{
    url: string;
    alt: string;
    isPrimary: boolean;
  }>;
  video?: {
    url: string;
    publicId?: string;
    thumbnail?: string;
  };
  specifications: Record<string, string>;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit: 'cm' | 'm';
  };
  materials: string[];
  finishes: string[];
  price?: {
    amount: number;
    currency: string;
    unit?: string;
  };
  availability: 'in_stock' | 'made_to_order' | 'out_of_stock';
  featured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface GalleryImage {
  _id?: string;
  title: string;
  description?: string;
  url: string;
  thumbnailUrl: string;
  category: string;
  tags: string[];
  alt: string;
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number;
  mimeType: string;
  featured: boolean;
  sortOrder: number;
  uploadedAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface Message {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  priority: 'low' | 'medium' | 'high';
  source: 'contact_form' | 'whatsapp' | 'email';
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  readAt?: Date;
  repliedAt?: Date;
  createdBy?: string;
  notes?: Array<{
    text: string;
    createdAt: Date;
    createdBy: string;
  }>;
}

export interface AdminUser {
  _id?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'editor';
  permissions: Array<{
    resource: string;
    actions: string[];
  }>;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Types pour les requêtes
export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  images: string[];
  video?: {
    url: string;
    publicId?: string;
    thumbnail?: string;
  };
  specifications?: Record<string, string>;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit: 'cm' | 'm';
  };
  materials?: string[];
  finishes?: string[];
  price?: {
    amount: number;
    currency: string;
    unit?: string;
  };
  availability?: 'in_stock' | 'made_to_order' | 'out_of_stock';
  featured?: boolean;
  tags?: string[];
}

export interface CreateMessageRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface UploadResponse {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}