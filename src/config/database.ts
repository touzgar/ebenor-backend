import mongoose from 'mongoose';
import { logger } from '../utils/logger';

class DatabaseConfig {
  private readonly mongoUri: string;

  constructor() {
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ebenor-creation';
  }

  public async connectDB(): Promise<void> {
    try {
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: true, // Changed to true to allow buffering when connection is retrying
      };

      await mongoose.connect(this.mongoUri, options);
      
      logger.info('✅ Connexion MongoDB établie avec succès');
      
      // Gestion des événements de connexion
      mongoose.connection.on('error', (error) => {
        logger.error('❌ Erreur de connexion MongoDB:', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ Connexion MongoDB fermée');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('🔄 Reconnexion MongoDB réussie');
      });

    } catch (error) {
      logger.error('❌ Erreur de connexion à MongoDB:', error);
      logger.error('🚨 MongoDB est REQUIS pour que l\'application fonctionne');
      logger.info('');
      logger.info('📋 SOLUTIONS POSSIBLES:');
      logger.info('1️⃣  Utiliser Docker (RECOMMANDÉ): docker-compose up -d');
      logger.info('2️⃣  Installer MongoDB: https://www.mongodb.com/try/download/community');
      logger.info('3️⃣  Utiliser MongoDB Atlas (gratuit): https://www.mongodb.com/cloud/atlas');
      logger.info('');
      throw error; // Always throw error - MongoDB is required
    }
  }

  public async disconnectDB(): Promise<void> {
    try {
      await mongoose.disconnect();
      logger.info('✅ Déconnexion MongoDB réussie');
    } catch (error) {
      logger.error('❌ Erreur lors de la déconnexion MongoDB:', error);
      throw error;
    }
  }

  public getConnectionState(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }
}

export const config = new DatabaseConfig();