import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ValidationPipe,
} from '@nestjs/common';
import { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import { UcheckSincronizacionService } from '../ucheck/ucheck-sincronizacion.service';
import { MarcacionUcheckDto } from './dto/marcacion-ucheck.dto';
import { IntegracionesUcheckService } from './integraciones-ucheck.service';
import { mensajeErrorUcheck } from './utils/mensaje-error';

const INTERVALO_MS = 15_000;
const POR_CONSULTA = 50;
// Cada vuelta confirma lo leído; Ucheck entrega después la salida de una visita
// cuya entrada ya se guardó. Con 10 vueltas alcanza y no se queda en bucle.
const VUELTAS_MAXIMAS = 10;

/**
 * Las marcaciones viven en Ucheck. Comercia las trae con GET, guarda su copia
 * (de la que cuelgan tareas, fotos y presentismo) y le confirma a Ucheck qué
 * guardó. Corre cada 15 s y apenas alguien marca desde Comercia.
 */
@Injectable()
export class SincronizacionMarcacionesService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SincronizacionMarcacionesService.name);
  private intervalo?: NodeJS.Timeout;
  private enCurso?: Promise<void>;
  private readonly validacion = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    expectedType: MarcacionUcheckDto,
  });

  constructor(
    private readonly ucheck: UcheckClienteService,
    private readonly aviso: UcheckSincronizacionService,
    private readonly integracion: IntegracionesUcheckService,
  ) {}

  onModuleInit() {
    this.aviso.registrar(() => this.sincronizar());
    if (!this.ucheck.configurado()) return;
    this.intervalo = setInterval(
      () =>
        void this.sincronizar().catch((e: unknown) =>
          this.logger.warn(`No se pudieron traer marcaciones: ${String(e)}`),
        ),
      INTERVALO_MS,
    );
    this.intervalo.unref();
  }

  onModuleDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  /** Una sola sincronización a la vez: quien llega durante una, la espera. */
  sincronizar(): Promise<void> {
    this.enCurso ??= this.ejecutar().finally(() => (this.enCurso = undefined));
    return this.enCurso;
  }

  private async ejecutar() {
    if (!this.ucheck.configurado()) return;
    for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS; vuelta++) {
      const { eventos } = await this.ucheck.pedir<{
        eventos: { id: string; payload: unknown }[];
      }>('/comercia-integracion/marcaciones/pendientes', {
        query: { limite: String(POR_CONSULTA) },
      });
      if (!eventos.length) return;
      const resultados: { id: string; visitaId?: number; error?: string }[] =
        [];
      for (const evento of eventos) {
        try {
          const dto = (await this.validacion.transform(evento.payload, {
            type: 'body',
          })) as MarcacionUcheckDto;
          const r = await this.integracion.registrarMarcacion(dto);
          resultados.push(
            'visitaId' in r && r.visitaId
              ? { id: evento.id, visitaId: r.visitaId }
              : { id: evento.id, error: 'Comercia no devolvió la visita' },
          );
        } catch (error: unknown) {
          resultados.push({ id: evento.id, error: mensajeErrorUcheck(error) });
        }
      }
      await this.ucheck.pedir(
        '/comercia-integracion/marcaciones/confirmaciones',
        {
          method: 'POST',
          body: { resultados },
        },
      );
    }
  }
}
