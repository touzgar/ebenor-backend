import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { AdminUser as IAdminUser } from '../types';

// Omit _id from IAdminUser to avoid conflicts with Mongoose's _id
type AdminUserBase = Omit<IAdminUser, '_id'>;

export interface AdminUserDocument extends AdminUserBase, mongoose.Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isLocked(): boolean;
  generatePasswordResetToken(): string;
  toPublicJSON(): any;
  hasPermission(resource: string, action: string): boolean;
}

const AdminUserSchema = new Schema<AdminUserDocument>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    maxlength: 100,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email invalide']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8
  },
  firstName: { 
    type: String, 
    required: true, 
    maxlength: 50,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true, 
    maxlength: 50,
    trim: true
  },
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'editor'],
    default: 'editor'
  },
  permissions: [{
    resource: { 
      type: String, 
      required: true,
      enum: ['products', 'gallery', 'messages', 'home_content', 'users', 'settings']
    },
    actions: [{ 
      type: String, 
      enum: ['create', 'read', 'update', 'delete']
    }]
  }],
  avatar: { type: String },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { type: Date },
  loginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockUntil: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date }
}, {
  timestamps: true,
  collection: 'admin_users'
});

// Index pour optimiser les requêtes
AdminUserSchema.index({ email: 1 }, { unique: true });
AdminUserSchema.index({ role: 1, isActive: 1 });
AdminUserSchema.index({ lastLogin: -1 });
AdminUserSchema.index({ passwordResetToken: 1 });

// Constantes pour la sécurité
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 heures

// Virtual pour le nom complet
AdminUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual pour vérifier si le compte est verrouillé
AdminUserSchema.virtual('isAccountLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Méthodes d'instance
AdminUserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

AdminUserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  // Si on a un verrou et qu'il a expiré, on reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Si on atteint le max, on verrouille le compte
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }
  
  return this.updateOne(updates);
};

AdminUserSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

AdminUserSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

AdminUserSchema.methods.generatePasswordResetToken = function(): string {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return token;
};

AdminUserSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

AdminUserSchema.methods.hasPermission = function(resource: string, action: string): boolean {
  // Super admin a tous les droits
  if (this.role === 'super_admin') {
    return true;
  }
  
  // Vérifier les permissions spécifiques
  const permission = this.permissions.find(p => p.resource === resource);
  return permission ? permission.actions.includes(action) : false;
};

// Méthodes statiques
AdminUserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

AdminUserSchema.statics.getActiveAdmins = function() {
  return this.find({ isActive: true }).select('-password');
};

AdminUserSchema.statics.createDefaultAdmin = async function() {
  const existingAdmin = await this.findOne({ role: 'super_admin' });
  if (existingAdmin) {
    return existingAdmin;
  }

  const defaultAdmin = new this({
    email: 'admin@ebenor-creation.tn',
    password: 'Admin123!',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    permissions: [
      { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'gallery', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'messages', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'home_content', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'settings', actions: ['create', 'read', 'update', 'delete'] }
    ]
  });

  return defaultAdmin.save();
};

// Middleware pre-save pour hasher le mot de passe
AdminUserSchema.pre('save', async function(next) {
  // Ne hasher que si le mot de passe a été modifié
  if (!this.isModified('password')) return next();

  try {
    // Valider la force du mot de passe
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(this.password)) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Middleware pre-save pour définir les permissions par défaut
AdminUserSchema.pre('save', function(next) {
  if (this.isNew && this.permissions.length === 0) {
    switch (this.role) {
      case 'super_admin':
        this.permissions = [
          { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'gallery', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'messages', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'home_content', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'settings', actions: ['create', 'read', 'update', 'delete'] }
        ];
        break;
      case 'admin':
        this.permissions = [
          { resource: 'products', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'gallery', actions: ['create', 'read', 'update', 'delete'] },
          { resource: 'messages', actions: ['read', 'update'] },
          { resource: 'home_content', actions: ['read', 'update'] }
        ];
        break;
      case 'editor':
        this.permissions = [
          { resource: 'products', actions: ['create', 'read', 'update'] },
          { resource: 'gallery', actions: ['create', 'read', 'update'] },
          { resource: 'messages', actions: ['read'] },
          { resource: 'home_content', actions: ['read'] }
        ];
        break;
    }
  }
  next();
});

// Middleware post-save pour logging
AdminUserSchema.post('save', function(doc) {
  if (doc.isNew) {
    console.log(`Nouvel utilisateur admin créé: ${doc.email} (${doc.role})`);
  }
});

export const AdminUser = (mongoose.models.AdminUser as Model<AdminUserDocument>) || mongoose.model<AdminUserDocument>('AdminUser', AdminUserSchema);