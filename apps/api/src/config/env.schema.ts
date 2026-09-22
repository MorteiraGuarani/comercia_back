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
