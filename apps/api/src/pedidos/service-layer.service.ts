import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
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

  // shortcut: el gateway no busca órdenes por U_beas_version; si se corta la respuesta del POST, reintentar puede duplicar. Agregar esa consulta al gateway si pasa.
  async crearOrden(
    credenciales: CredencialesSap,
    orden: PedidoSap,
  ): Promise<OrdenSapCreada> {
    const { sessionId } = await this.pedir<SesionSap>(
      '/auth/login',
      undefined,
      {
        CompanyDB: credenciales.esquema,
        UserName: credenciales.usuario,
        Password: credenciales.contrasenia,
      },
    );
    try {
      return await this.pedir<OrdenSapCreada>('/document/create', sessionId, {
        document: 'Orders',
        // El gateway exige estos dos y solo comprueba que su tabla de layouts exista.
        schema: 'PL_SERVICES',
        layout: 'layout_orden',
        data: orden,
      });
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
      throw new BadGatewayException(`SAP: ${mensaje}`);
    }
    return datos as T;
  }
}
