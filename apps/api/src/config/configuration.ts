import { parseCorsOrigins, parseTrustProxy } from './env.schema';

export default () => ({
  app: {
    env: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    frontendUrl: process.env.FRONTEND_URL,
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS ?? ''),
    swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
    cookieSecret: process.env.COOKIE_SECRET,
    httpBodyLimitMb: Number(process.env.HTTP_BODY_LIMIT_MB),
    httpBodyLimitGeneralMb: Number(process.env.HTTP_BODY_LIMIT_GENERAL_MB),
  },
  uploads: {
    fotosRetencionDias: Number(process.env.FOTOS_RETENCION_DIAS ?? 0),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  security: {
    throttleTtl: Number(process.env.THROTTLE_TTL),
    throttleLimit: Number(process.env.THROTTLE_LIMIT),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY ?? ''),
    loginSimHabilitado: ['1', 'true', 'yes', 'on'].includes(
      (process.env.LOGIN_SIM_HABILITADO ?? '').toLowerCase(),
    ),
  },
  integrations: {
    ucheckSecret: process.env.UCHECK_INTEGRATION_SECRET,
    ucheckApiUrl: process.env.UCHECK_API_URL,
    ucheckSsoSecret:
      process.env.UCHECK_SSO_SECRET ?? process.env.UCHECK_INTEGRATION_SECRET,
  },
});
