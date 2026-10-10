# syntax=docker/dockerfile:1
# Image de production de l'API. Contexte de build : racine du monorepo.
#   docker build -f apps/api/Dockerfile -t taskflow-api .

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# --- Build : toutes les dépendances, compilation TypeScript ---
FROM base AS build
RUN npm ci -w apps/api
COPY apps/api apps/api
RUN npm run db:generate -w apps/api && npm run build -w apps/api

# --- Dépendances de production uniquement (prisma CLI inclus pour les migrations) ---
FROM base AS prod-deps
RUN npm ci -w apps/api --omit=dev && npm cache clean --force
COPY apps/api/prisma apps/api/prisma
RUN npm run db:generate -w apps/api

# --- Image finale : non-root, sans sources ni outils de build ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1
CMD ["node", "dist/main.js"]
