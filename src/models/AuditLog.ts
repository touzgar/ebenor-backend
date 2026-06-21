import mongoose, { Schema, Model } from 'mongoose';

export interface AuditLog {
  userId: string;
  userEmail?: string;
  action: 'create' | 'update' | 'delete' | 'bulk_delete' | 'bulk_update' | 'login' | 'logout' | 'password_change' | 'upload' | 'download';
  resource: 'product' | 'gallery' | 'home' | 'message' | 'user' | 'media' | 'auth';
  resourceId?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AuditLogDocument extends AuditLog, mongoose.Document {
  toPublicJSON(): any;
}

const AuditLogSchema = new Schema<AuditLogDocument>({
  userId: { 
    type: String, 
    required: true
  },
  userEmail: { 
    type: String,
    maxlength: 100
  },
  action: { 
    type: String, 
    required: true,
    enum: ['create', 'update', 'delete', 'bulk_delete', 'bulk_update', 'login', 'logout', 'password_change', 'upload', 'download']
  },
  resource: { 
    type: String, 
    required: true,
    enum: ['product', 'gallery', 'home', 'message', 'user', 'media', 'auth']
  },
  resourceId: { 
    type: String
  },
  changes: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed }
  },
  ipAddress: { 
    type: String,
    maxlength: 45 // IPv6 max length
  },
  userAgent: { 
    type: String,
    maxlength: 500
  },
  timestamp: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  collection: 'audit_logs'
});

// Compound indexes for common queries
// Requirement: Compound index for resource and resourceId
AuditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });

// Requirement: Compound index for userId and timestamp
AuditLogSchema.index({ userId: 1, timestamp: -1 });

// Additional indexes for common query patterns
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 }); // For recent logs

// TTL index to automatically delete logs older than 90 days (combines timestamp index with TTL)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'timestamp_ttl' });

// Static methods
AuditLogSchema.statics.getRecentLogs = function(limit = 50) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit);
};

AuditLogSchema.statics.getLogsByUser = function(userId: string, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

AuditLogSchema.statics.getLogsByResource = function(resource: string, resourceId: string, limit = 50) {
  return this.find({ resource, resourceId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

AuditLogSchema.statics.getLogsByAction = function(action: string, limit = 50) {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit);
};

AuditLogSchema.statics.getLogsByDateRange = function(startDate: Date, endDate: Date, limit = 100) {
  return this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

AuditLogSchema.statics.getDestructiveOperations = function(limit = 50) {
  return this.find({
    action: { $in: ['delete', 'bulk_delete'] }
  })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Instance methods
AuditLogSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export const AuditLog = (mongoose.models.AuditLog as Model<AuditLogDocument>) || mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema);
