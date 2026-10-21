# Comercia

Monorepo fullstack con Next.js, NestJS y PostgreSQL.

## Estructura

- `apps/web`: frontend Next.js con App Router, TypeScript y Tailwind.
- `apps/api`: backend NestJS con Prisma, PostgreSQL, validacion de entorno, Helmet, CORS controlado, rate limiting, Swagger y healthchecks.

## Primer arranque

```bash
npm install
copy .env.example .env
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Qué hace cada archivo `.env` (raíz, `apps/api`, `apps/web`, servidor): ver [ENV.md](ENV.md).
Checklist de todo lo que hay que configurar en local y producción: ver [SETUP.md](SETUP.md).
Cómo subir cambios y operar producción en el día a día: ver [FLUJO-DIARIO.md](FLUJO-DIARIO.md).
Dónde viven los servicios en el servidor y cómo inspeccionarlos: ver [SERVICIOS-SERVIDOR.md](SERVICIOS-SERVIDOR.md).

Servicios por defecto:

- Web: `http://localhost:3000`
- API: `http://localhost:3001/api/v1`
- Swagger: `http://localhost:3001/api/docs`
- Healthcheck: `http://localhost:3001/api/v1/health`

API pública de socios de negocio, tablas y ejemplos de carga individual/bulk:
[guía de socios de negocio](docs/socios-negocio.md).

Maestro oficial de artículos OITM, precios por lista y precios especiales:
[guía del catálogo](docs/catalogo-articulos.md).

## Comandos utiles

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run db:up
npm run db:down
npm run prisma:studio
```

## Despliegue

El proyecto está dockerizado (multi-stage builds para `apps/api` y `apps/web`) y se
despliega solo: cada push a `main` corre CI, construye las imágenes que cambiaron,
las publica en GHCR y actualiza el servidor por SSH con Docker Compose + Caddy (HTTPS
automático). Guía completa en [DEPLOY.md](DEPLOY.md).

## Seguridad base

- Variables validadas con Zod al iniciar la API.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y transformaciones seguras.
- CORS limitado por `CORS_ORIGINS`.
- Helmet, compresion, limite de payload y cookies firmables.
- Rate limiting global via `@nestjs/throttler`.
- Prisma con migrations y queries tipadas.
- `package.json` usa `overrides` para forzar parches transitivos de seguridad en `multer`, `postcss` y `@hono/node-server` mientras upstream publica rangos actualizados.

Antes de produccion, reemplazar credenciales y `COOKIE_SECRET`, configurar CORS con dominios reales, agregar autenticacion/autorizacion por recurso y revisar `npm audit`.
