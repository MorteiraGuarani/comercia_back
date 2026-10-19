import { z } from 'zod';

const defaultDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5434/comercia?schema=public';

const booleanFromString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const rawEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().min(1).optional(),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    THROTTLE_TTL: z.coerce.number().int().min(1000).default(60000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
    // Proxies de confianza para leer la IP real (sintaxis de Express "trust
    // proxy"). Vacío: se usa la IP de la conexión.
    TRUST_PROXY: z.string().default(''),
    // Solo para la carga masiva del catálogo de productos; el resto de la API
    // usa HTTP_BODY_LIMIT_GENERAL_MB.
    HTTP_BODY_LIMIT_MB: z.coerce.number().int().min(1).max(256).default(50),
    HTTP_BODY_LIMIT_GENERAL_MB: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(1),
    // El número de la SIM lo informa el propio teléfono y no prueba identidad:
    // queda apagado salvo que se active a conciencia (ver ENV.md).
    LOGIN_SIM_HABILITADO: booleanFromString.default(false),
    // Días que se guardan las fotos de tareas; 0 = no se borra nada. Si se
    // activa, mínimo 90 para que un valor mal puesto no borre fotos recientes.
    FOTOS_RETENCION_DIAS: z.coerce
      .number()
      .int()
      .min(0)
      .max(3650)
      .refine((dias) => dias === 0 || dias >= 90, {
        message: 'debe ser 0 (apagado) o al menos 90',
      })
      .default(0),
    SWAGGER_ENABLED: booleanFromString.default(true),
    COOKIE_SECRET: z.string().min(32).optional(),
    UCHECK_INTEGRATION_SECRET: z.string().min(32).optional(),
    UCHECK_API_URL: z.string().url().optional(),
    UCHECK_SSO_SECRET: z.string().min(32).optional(),
  })
  .superRefine((env, context) => {
    const tieneSecretoSso = Boolean(
      env.UCHECK_SSO_SECRET ?? env.UCHECK_INTEGRATION_SECRET,
    );
    if (
      (Boolean(env.UCHECK_API_URL) && !tieneSecretoSso) ||
      (Boolean(env.UCHECK_SSO_SECRET) && !env.UCHECK_API_URL)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['UCHECK_API_URL'],
        message:
          'UCHECK_API_URL y un secreto SSO de UCHECK deben configurarse juntos',
      });
    }
  });

export type Env = z.infer<typeof rawEnvSchema> & {
  DATABASE_URL: string;
};

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// "" o "false": desactivado; "true": cualquier proxy (inseguro si la API
// también se publica directo); número: saltos; resto: IPs, subredes o
// nombres de Express ("loopback, linklocal, uniquelocal").
export function parseTrustProxy(value: string): boolean | number | string {
  const valor = value.trim();
  if (!valor || valor.toLowerCase() === 'false') return false;
  if (valor.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(valor)) return Number(valor);
  return valor;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = rawEnvSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  if (parsed.data.NODE_ENV === 'production' && !parsed.data.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (
    parsed.data.NODE_ENV === 'production' &&
    !parsed.data.UCHECK_INTEGRATION_SECRET
  ) {
    throw new Error('UCHECK_INTEGRATION_SECRET is required in production');
  }

  const env = {
    ...parsed.data,
    DATABASE_URL: parsed.data.DATABASE_URL ?? defaultDatabaseUrl,
  };

  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= String(value);
  }

  return env;
}
