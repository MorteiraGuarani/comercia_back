import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PedidoUcheck {
  method?: 'GET' | 'POST';
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Tiempo máximo de espera en milisegundos. */
  espera?: number;
}

/**
 * Cliente servidor a servidor de Ucheck, donde se guardan las marcaciones y
 * los pings del equipo de campo. Un rechazo de Ucheck (4xx) se devuelve con
 * su mensaje; sin conexión o con error interno, 503.
 */
@Injectable()
export class UcheckClienteService {
  constructor(private readonly config: ConfigService) {}

  configurado() {
    return Boolean(
      this.config.get<string>('integrations.ucheckApiUrl') &&
      this.config.get<string>('integrations.ucheckSecret'),
    );
  }

  async pedir<T>(ruta: string, pedido: PedidoUcheck = {}): Promise<T> {
    const base = this.config
      .get<string>('integrations.ucheckApiUrl')
      ?.replace(/\/$/, '');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      throw new ServiceUnavailableException('Ucheck no está configurado');
    const query = new URLSearchParams(
      Object.entries(pedido.query ?? {}).filter(
        (p): p is [string, string] => p[1] !== undefined,
      ),
    ).toString();
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}${ruta}${query ? `?${query}` : ''}`, {
        method: pedido.method ?? 'GET',
        signal: AbortSignal.timeout(pedido.espera ?? 15_000),
        headers: {
          Authorization: `Bearer ${secreto}`,
          'Content-Type': 'application/json',
        },
        body:
          pedido.body === undefined ? undefined : JSON.stringify(pedido.body),
      });
    } catch {
      throw new ServiceUnavailableException('No se pudo conectar con Ucheck');
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as
      (T & { message?: unknown }) | null;
    if (respuesta.ok) return cuerpo as T;
    const mensaje = cuerpo?.message;
    const texto = Array.isArray(mensaje)
      ? mensaje.join('. ')
      : typeof mensaje === 'string'
        ? mensaje
        : `Ucheck respondió HTTP ${respuesta.status}`;
    if (respuesta.status >= 400 && respuesta.status < 500)
      throw new HttpException(texto, respuesta.status);
    throw new ServiceUnavailableException(texto);
  }
}
