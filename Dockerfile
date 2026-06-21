# Dockerfile pour production
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY src/ ./src/

# Construire l'application
RUN npm run build

# Image de production
FROM node:20-alpine AS production

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ebenor -u 1001

# Copier les dépendances de production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

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

# Dockerfile pour développement
FROM node:20-alpine AS development

WORKDIR /app

# Installer les dépendances globales
RUN npm install -g tsx

# Copier les fichiers de configuration
COPY package*.json ./
COPY tsconfig.json ./

# Installer toutes les dépendances (dev incluses)
RUN npm install

# Copier le code source
COPY src/ ./src/

# Exposer le port
EXPOSE 5000

# Variables d'environnement pour le développement
ENV NODE_ENV=development
ENV PORT=5000

# Commande de développement avec hot reload
CMD ["npm", "run", "dev"]