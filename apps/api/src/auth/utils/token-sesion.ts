import { AUTH_COOKIE } from '../auth.constants';

export interface SolicitudConSesion {
  headers?: { authorization?: unknown };
  cookies?: unknown;
}

// Token de sesión: Bearer de la app móvil o, si no hay, cookie httpOnly de la web.
export function tokenSesion(
  req: SolicitudConSesion,
): { token: string; bearer: boolean } | null {
  const authorization = req.headers?.authorization;
  const bearer =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
  if (bearer) return { token: bearer, bearer: true };
  const cookie = (req.cookies as Record<string, unknown> | undefined)?.[
    AUTH_COOKIE
  ];
  return typeof cookie === 'string' && cookie
    ? { token: cookie, bearer: false }
    : null;
}
