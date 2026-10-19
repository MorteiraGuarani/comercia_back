// Cliente mínimo para la API de Comercia (se usa desde Client Components).
// Las cookies de sesión son httpOnly y viajan con credentials: 'include'.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function extraerMensaje(data: unknown): string | null {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: string | string[] }).message;
    return Array.isArray(m) ? m.join(". ") : m;
  }
  return null;
}

// Un corte breve (túnel a la base, señal móvil) suele resolverse en segundos:
// las lecturas se reintentan una vez antes de mostrar el error.
const ESTADOS_REINTENTABLES = new Set([0, 502, 503, 504]);
const ESPERA_REINTENTO_MS = 1500;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    return await pedir<T>(path, init);
  } catch (error) {
    const lectura = (init?.method ?? "GET").toUpperCase() === "GET";
    if (
      !lectura ||
      !(error instanceof ApiError) ||
      !ESTADOS_REINTENTABLES.has(error.status) ||
      init?.signal?.aborted ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    )
      throw error;
    await new Promise((resolver) => setTimeout(resolver, ESPERA_REINTENTO_MS));
    if (init?.signal?.aborted) throw error;
    return pedir<T>(path, init);
  }
}

async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers = new Headers(init?.headers);
    const esFormulario =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (!esFormulario && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      extraerMensaje(data) ?? `Error ${res.status}`,
    );
  }
  return data as T;
}
