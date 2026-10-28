# Imagen de producción de la API NestJS + Prisma.
# Contexto de build: la RAÍZ del monorepo (docker build -f apps/api/Dockerfile .)
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# ---------- Dependencias completas (para compilar) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=api --ignore-scripts --fetch-retries=5 --fetch-timeout=600000

# ---------- Build (prisma generate + nest build) ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/api/ apps/api/
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# ---------- Dependencias solo de producción ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --workspace=api --omit=dev --ignore-scripts --fetch-retries=5 --fetch-timeout=600000 && npm cache clean --force

# ---------- Runtime ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=3001 \
    npm_config_update_notifier=false \
    npm_config_cache=/tmp/.npm-cache
RUN addgroup -S nodejs && adduser -S -G nodejs -h /home/api api
WORKDIR /app
COPY --from=prod-deps --chown=api:nodejs /app /app
COPY --from=build --chown=api:nodejs /app/apps/api/dist /app/apps/api/dist
# El binario schema-engine (descargado durante `prisma generate` en build) es
# necesario para `prisma migrate deploy`; sin él, migrate intentaría bajarlo
# de internet en cada arranque del contenedor.
COPY --from=build --chown=api:nodejs /app/node_modules/@prisma/engines /app/node_modules/@prisma/engines
# El esquema, las migraciones y prisma.config.ts se necesitan para `prisma migrate deploy`
COPY --chown=api:nodejs apps/api/prisma /app/apps/api/prisma
COPY --chown=api:nodejs apps/api/prisma.config.ts /app/apps/api/prisma.config.ts
# Carpeta de archivos subidos (fotos de visitas); en prod se monta el volumen
# uploads_data acá. Se crea con dueño api para que el proceso pueda escribir.
RUN mkdir -p /app/uploads && chown api:nodejs /app/uploads
USER api
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3001/api/v1/health || exit 1
CMD ["node", "dist/src/main.js"]
