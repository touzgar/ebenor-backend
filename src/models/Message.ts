import mongoose, { Schema, Model } from 'mongoose';
import { Message as IMessage } from '../types';

// Omit _id from IMessage to avoid conflicts with Mongoose's _id
type MessageBase = Omit<IMessage, '_id'>;

export interface MessageDocument extends MessageBase, mongoose.Document {
  toPublicJSON(): any;
  markAsRead(userId: string): Promise<MessageDocument>;
  markAsReplied(userId: string): Promise<MessageDocument>;
  addNote(text: string, userId: string): Promise<MessageDocument>;
  setPriority(priority: 'low' | 'medium' | 'high'): Promise<MessageDocument>;
}

const MessageSchema = new Schema<MessageDocument>({
  name: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    maxlength: 100,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide']
  },
  phone: { 
    type: String, 
    maxlength: 20,
    trim: true,
    match: [/^[\+]?[0-9\s\-\(\)]{8,20}$/, 'Numéro de téléphone invalide']
  },
  subject: { 
    type: String, 
    required: true, 
    maxlength: 200,
    trim: true
  },
  message: { 
    type: String, 
    required: true, 
    maxlength: 5000,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['new', 'read', 'replied', 'archived'],
    default: 'new'
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  source: { 
    type: String, 
    enum: ['contact_form', 'whatsapp', 'email'],
    default: 'contact_form'
  },
  ipAddress: { 
    type: String,
    // Pas de validation stricte - accepter tous les formats d'IP (IPv4, IPv6, localhost, etc.)
  },
  userAgent: { 
    type: String, 
    maxlength: 500 
  },
  readAt: { type: Date },
  repliedAt: { type: Date },
  notes: [{
    text: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true }
  }],
  createdBy: { 
    type: String 
  }
}, {
  timestamps: true,
  collection: 'messages'
});

// Index pour optimiser les requêtes
// Compound index for status and createdAt (common query pattern)
MessageSchema.index({ status: 1, createdAt: -1 });

// Additional indexes for common query patterns
MessageSchema.index({ priority: -1, createdAt: -1 });
MessageSchema.index({ email: 1 });
MessageSchema.index({ source: 1, createdAt: -1 });
MessageSchema.index({ createdAt: -1 });

// Index de recherche textuelle
MessageSchema.index({
  name: 'text',
  email: 'text',
  subject: 'text',
  message: 'text'
}, {
  weights: {
    subject: 10,
    name: 5,
    email: 3,
    message: 1
  }
});

// Méthodes personnalisées
MessageSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  delete obj.ipAddress;
  delete obj.userAgent;
  delete obj.notes;
  return obj;
};

MessageSchema.methods.markAsRead = function(userId: string) {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

MessageSchema.methods.markAsReplied = function(userId: string) {
  this.status = 'replied';
  this.repliedAt = new Date();
  return this.save();
};

MessageSchema.methods.addNote = function(text: string, userId: string) {
  this.notes.push({
    text,
    createdAt: new Date(),
    createdBy: userId
  });
  return this.save();
};

MessageSchema.methods.setPriority = function(priority: 'low' | 'medium' | 'high') {
  this.priority = priority;
  return this.save();
};

// Méthodes statiques
MessageSchema.statics.getUnreadCount = function() {
  return this.countDocuments({ status: 'new' });
};

MessageSchema.statics.getByStatus = function(status: string, limit = 50) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit);
};

MessageSchema.statics.getRecentMessages = function(days = 7, limit = 20) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({ createdAt: { $gte: startDate } })
    .sort({ createdAt: -1 })
    .limit(limit);
};

MessageSchema.statics.getHighPriorityMessages = function(limit = 10) {
  return this.find({ priority: 'high', status: { $in: ['new', 'read'] } })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Middleware pre-save
MessageSchema.pre('save', function(next) {
  // Déterminer automatiquement la priorité basée sur le contenu
  if (this.isNew && !this.priority) {
    const urgentKeywords = ['urgent', 'rapidement', 'vite', 'immédiat', 'emergency'];
    const messageText = (this.subject + ' ' + this.message).toLowerCase();
    
    if (urgentKeywords.some(keyword => messageText.includes(keyword))) {
      this.priority = 'high';
    } else if (this.phone) {
      // Si un numéro de téléphone est fourni, c'est souvent plus urgent
      this.priority = 'medium';
    } else {
      this.priority = 'low';
    }
  }

  // Nettoyer et valider les données
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.subject) {
    this.subject = this.subject.trim();
  }
  if (this.message) {
    this.message = this.message.trim();
  }

  next();
});

// Middleware post-save pour logging et notifications
MessageSchema.post('save', function(doc) {
  if (doc.isNew) {
    console.log(`Nouveau message reçu de: ${doc.name} (${doc.email}) - Priorité: ${doc.priority}`);
    // Ici on pourrait ajouter la logique d'envoi de notifications
  }
});

// Virtual pour calculer l'âge du message
MessageSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    return 'Il y a moins d\'une heure';
  } else if (diffHours < 24) {
    return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  }
});

export const Message = (mongoose.models.Message as Model<MessageDocument>) || mongoose.model<MessageDocument>('Message', MessageSchema);