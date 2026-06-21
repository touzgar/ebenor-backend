# Dockerfile pour production
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer TOUTES les dépendances (including devDependencies for TypeScript)
RUN npm ci && npm cache clean --force

# Copier le code source
COPY src/ ./src/

# Construire l'application
RUN npm run build

# Image de production
FROM node:20-alpine

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ebenor -u 1001

# Installer SEULEMENT les dépendances de production
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copier les fichiers buildés
COPY --from=builder /app/dist ./dist

# Créer les répertoires nécessaires
RUN mkdir -p logs uploads && \
    chown -R ebenor:nodejs /app

# Changer vers l'utilisateur non-root
USER ebenor

# Exposer le port
EXPOSE 5000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=5000

# Commande de démarrage
CMD ["npm", "start"]