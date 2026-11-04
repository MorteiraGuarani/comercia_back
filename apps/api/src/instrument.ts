// main.ts lo importa antes que todo: Sentry tiene que cargarse primero.
import * as Sentry from '@sentry/nestjs';

// Sin SENTRY_DSN no se envía nada (desarrollo y pruebas).
if (process.env.SENTRY_DSN)
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Solo errores, sin trazas de rendimiento (Sentry no manda datos personales por defecto).
    tracesSampleRate: 0,
  });
