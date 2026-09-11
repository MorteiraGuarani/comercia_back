import { parseCorsOrigins } from './env.schema';

export default () => ({
  app: {
    env: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    frontendUrl: process.env.FRONTEND_URL,
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS ?? ''),
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
    cookieSecret: process.env.COOKIE_SECRET,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  security: {
    throttleTtl: Number(process.env.THROTTLE_TTL),
    throttleLimit: Number(process.env.THROTTLE_LIMIT),
  },
  integrations: {
    ucheckSecret: process.env.UCHECK_INTEGRATION_SECRET,
  },
});
