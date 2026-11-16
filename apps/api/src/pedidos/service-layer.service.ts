import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PedidoSap } from './interfaces/pedido-sap.interface';
import type {
  CredencialesSap,
  OrdenSapCreada,
  SesionSap,
} from './interfaces/service-layer.interface';

// Por encima de los 60 s con los que el gateway espera al Service Layer.
const ESPERA_MS = 70_000;

/** Service Layer de SAP B1 a través del gateway UniversalBack. */
@Injectable()
export class ServiceLayerService {
  private readonly logger = new Logger(ServiceLayerService.name);

  constructor(private readonly config: ConfigService) {}

  /** Una orden con su propia sesión. */
  crearOrden(
    credenciales: CredencialesSap,
    orden: PedidoSap,
  ): Promise<OrdenSapCreada> {
    return this.conSesion(credenciales, async (sesion) => {
      const desde = Date.now();
      const creada = await this.pedir<OrdenSapCreada>(
        '/document/create',
        sesion,
        {
          document: 'Orders',
          // Opcionales en el gateway actual; se mandan para uno sin actualizar.
          schema: 'PL_SERVICES',
          layout: 'layout_orden',
          data: orden,
        },
      );
      this.logger.log(
        `Orden ${creada.DocNum ?? '?'} creada en SAP en ${Date.now() - desde} ms`,
      );
      return creada;
    });
  }

  /**
   * Varias órdenes con un solo login, en un $batch del gateway: SAP crea todas
   * o ninguna. Devuelve lo creado en el mismo orden.
   */
  async crearOrdenes(
    credenciales: CredencialesSap,
    ordenes: PedidoSap[],
  ): Promise<OrdenSapCreada[]> {
    if (ordenes.length === 1)
      return [await this.crearOrden(credenciales, ordenes[0])];
    return this.conSesion(credenciales, async (sesion) => {
      const desde = Date.now();
      const creadas = await this.pedir<OrdenSapCreada[]>(
        '/document/batch',
        sesion,
        { document: 'Orders', data: ordenes },
      );
      if (!Array.isArray(creadas) || creadas.length !== ordenes.length) {
        this.logger.error(
          `POST /document/batch: se esperaban ${ordenes.length} órdenes y llegó otra respuesta`,
        );
        throw new UnprocessableEntityException(
          'SAP respondió el lote de forma inesperada. Revisá en SAP si las órdenes se crearon antes de reenviar',
        );
      }
      this.logger.log(
        `${ordenes.length} órdenes (${creadas.map((c) => c.DocNum ?? '?').join(', ')}) creadas en SAP en un $batch en ${Date.now() - desde} ms`,
      );
      return creadas;
    });
  }

  // shortcut: el gateway no busca órdenes por U_beas_version; si se corta la respuesta del POST, reintentar puede duplicar. Agregar esa consulta al gateway si pasa.
  private async conSesion<T>(
    credenciales: CredencialesSap,
    usar: (sesion: string) => Promise<T>,
  ): Promise<T> {
    const inicio = Date.now();
    const { sessionId } = await this.pedir<SesionSap>(
      '/auth/login',
      undefined,
      {
        CompanyDB: credenciales.esquema,
        UserName: credenciales.usuario,
        Password: credenciales.contrasenia,
      },
    );
    this.logger.log(`Login SAP en ${Date.now() - inicio} ms`);
    try {
      return await usar(sessionId);
    } finally {
      await this.pedir('/auth/logout', sessionId).catch(() => undefined);
    }
  }

  private async pedir<T>(
    ruta: string,
    sessionid?: string,
    cuerpo?: object,
  ): Promise<T> {
    const base = this.config
      .get<string>('integrations.sapApiUrl')
      ?.replace(/\/$/, '');
    if (!base) throw new ServiceUnavailableException('SAP no está configurado');
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}${ruta}`, {
        method: 'POST',
        signal: AbortSignal.timeout(ESPERA_MS),
        headers: {
          'Content-Type': 'application/json',
          ...(sessionid ? { sessionid } : {}),
        },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch (error) {
      this.logger.error(
        `POST ${ruta}: sin respuesta de SAP · ${
          error instanceof Error ? error.name : 'error'
        }`,
      );
      throw new ServiceUnavailableException('No se pudo conectar con SAP');
    }
    const texto = await respuesta.text();
    let datos: unknown = null;
    try {
      datos = JSON.parse(texto);
    } catch {
      // El gateway siempre responde JSON; si no, queda como respuesta vacía.
    }
    if (!respuesta.ok) {
      const motivo = (datos as { message?: unknown } | null)?.message;
      const mensaje =
        typeof motivo === 'string' ? motivo : `Error ${respuesta.status}`;
      this.logger.error(`POST ${ruta}: HTTP ${respuesta.status} · ${mensaje}`);
      // 422 y no 502: Cloudflare reemplaza los 502/504 por su propia página y
      // el motivo de SAP (y las cabeceras CORS) no llegarían al navegador.
      throw new UnprocessableEntityException(`SAP: ${mensaje}`);
    }
    return datos as T;
  }
}
