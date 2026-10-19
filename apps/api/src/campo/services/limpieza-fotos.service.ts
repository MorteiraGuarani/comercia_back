import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'node:fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { resolverRutaFoto } from '../utils/multer-config';
import { limiteRetencionFotos } from '../utils/retencion-fotos';

const PRIMERA_PASADA_MS = 10 * 60 * 1000;
const INTERVALO_MS = 24 * 60 * 60 * 1000;
const POR_LOTE = 200;
const MAX_LOTES = 20;

/**
 * Borra las fotos de tareas más antiguas que FOTOS_RETENCION_DIAS (apagado
 * con 0, el valor por defecto). Primero borra los registros y después los
 * archivos: si un archivo no se puede borrar queda huérfano en disco, pero
 * nunca una foto registrada sin su archivo.
 */
@Injectable()
export class LimpiezaFotosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LimpiezaFotosService.name);
  private primeraPasada?: ReturnType<typeof setTimeout>;
  private intervalo?: ReturnType<typeof setInterval>;
  private procesando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private dias(): number {
    return this.config.get<number>('uploads.fotosRetencionDias') ?? 0;
  }

  onModuleInit() {
    if (this.dias() <= 0) return;
    this.logger.log(`Retención de fotos de tareas: ${this.dias()} días`);
    this.primeraPasada = setTimeout(
      () => void this.limpiar(),
      PRIMERA_PASADA_MS,
    );
    this.intervalo = setInterval(() => void this.limpiar(), INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.primeraPasada) clearTimeout(this.primeraPasada);
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async limpiar(ahora = new Date()): Promise<number> {
    const limite = limiteRetencionFotos(ahora, this.dias());
    if (!limite || this.procesando) return 0;
    this.procesando = true;
    let borradas = 0;
    try {
      for (let lote = 0; lote < MAX_LOTES; lote++) {
        const fotos = await this.prisma.fotoTareaCampo.findMany({
          where: { creadoAt: { lt: limite } },
          select: { id: true, rutaArchivo: true },
          orderBy: { id: 'asc' },
          take: POR_LOTE,
        });
        if (fotos.length === 0) break;
        await this.prisma.fotoTareaCampo.deleteMany({
          where: { id: { in: fotos.map((f) => f.id) } },
        });
        await Promise.all(
          fotos.map((f) =>
            unlink(resolverRutaFoto(f.rutaArchivo)).catch(() => undefined),
          ),
        );
        borradas += fotos.length;
        if (fotos.length < POR_LOTE) break;
      }
      if (borradas > 0) {
        const fecha = limite.toISOString().slice(0, 10);
        this.logger.log(`Se borraron ${borradas} fotos anteriores al ${fecha}`);
      }
    } catch (error) {
      this.logger.error('No se pudo completar la limpieza de fotos', error);
    } finally {
      this.procesando = false;
    }
    return borradas;
  }
}
