# Imagen de producción del frontend Next.js (output standalone).
# Contexto de build: la RAÍZ del monorepo (docker build -f apps/web/Dockerfile .)
# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# ---------- Dependencias ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=web --ignore-scripts

# ---------- Build ----------
FROM base AS build
# Las NEXT_PUBLIC_* salen de apps/web/.env.production (Next lo carga solo
# porque `next build` corre con NODE_ENV=production) y se hornean en el bundle.
# Cada deploy recibe el SHA del commit para que Next detecte versiones antiguas
# abiertas en el navegador y agregue cache-busting a los assets estáticos.
ARG NEXT_DEPLOYMENT_ID=local
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json package-lock.json ./
COPY apps/web/ apps/web/
WORKDIR /app/apps/web
RUN npm run build

# ---------- Runtime ----------
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S -G nodejs -h /home/web web
WORKDIR /app
# Con outputFileTracingRoot en la raíz del monorepo, el standalone replica
# la estructura apps/web/server.js con node_modules mínimos en la raíz.
COPY --from=build --chown=web:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=web:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=web:nodejs /app/apps/web/public ./apps/web/public
USER web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/web/server.js"]
