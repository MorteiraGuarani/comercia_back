import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  type Prisma,
  TipoNotificacionCampo,
} from '../../generated/prisma/client';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { nombreLocal } from '../campo/utils/local-ocrd';
import { textoAvisoVencimiento } from './utils/vencimiento';
import { obtenerSuperioresActivos } from '../common/utils/superiores';

const INTERVALO_MS = 60 * 60 * 1000;
const PRIMERA_PASADA_MS = 30_000;

/**
 * Avisa en la campana los productos por vencer: por cada producto y local se
 * mira solo su última carga, y se avisa una vez cuando faltan los días que
 * configuró la empresa (o menos, incluso si ya venció).
 */
@Injectable()
export class VencimientosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VencimientosService.name);
  private primeraPasada?: ReturnType<typeof setTimeout>;
  private intervalo?: ReturnType<typeof setInterval>;
  private procesando = false;
  // Un pedido durante una pasada se repite al terminarla (cargas recién guardadas).
  private repetir = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.primeraPasada = setTimeout(
      () => void this.procesar(),
      PRIMERA_PASADA_MS,
    );
    this.intervalo = setInterval(() => void this.procesar(), INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.primeraPasada) clearTimeout(this.primeraPasada);
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async procesar(): Promise<number> {
    if (this.procesando) {
      this.repetir = true;
      return 0;
    }
    this.procesando = true;
    try {
      // La marca y los avisos se confirman juntos: un fallo o reinicio no pierde el envío.
      return await this.prisma.$transaction(
        async (tx) => {
          const hoy = relojCampo().fecha;
          // Reclamar con UPDATE ... RETURNING: dos instancias nunca avisan la misma carga.
          const reclamadas = await tx.$queryRaw<{ id: number }[]>`
        UPDATE campo_inventario_cargas c SET avisado_en = now()
        FROM (
          SELECT DISTINCT ON (empresa_id, "CardCode", "ItemCode")
            id, empresa_id, avisado_en, cantidad, vencimiento
          FROM campo_inventario_cargas
          ORDER BY empresa_id, "CardCode", "ItemCode", fecha DESC
        ) u
        JOIN empresas e ON e.id = u.empresa_id
        WHERE c.id = u.id AND c.avisado_en IS NULL AND u.avisado_en IS NULL AND u.cantidad > 0
          AND u.vencimiento <= ${hoy}::date + e.dias_aviso_vencimiento
        RETURNING c.id`;
          const ids = reclamadas.map((r) => r.id);
          if (!ids.length) return 0;
          const cargas = await tx.cargaInventarioCampo.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              empresaId: true,
              localId: true,
              itemcode: true,
              cantidad: true,
              vencimiento: true,
              usuarioId: true,
              local: { select: { CardCode: true, CardName: true } },
            },
            take: ids.length,
          });
          const nombres = new Map(
            (
              await tx.producto.findMany({
                where: { itemcode: { in: cargas.map((c) => c.itemcode) } },
                select: { itemcode: true, itemname: true },
              })
            ).map((p) => [p.itemcode, p.itemname]),
          );
          const fecha = fechaCampo(hoy);
          const avisos: Prisma.NotificacionCampoCreateManyInput[] = [];
          for (const carga of cargas) {
            // Quien cargó, el personal asignado hoy y toda su cadena de superiores.
            const asignados = await tx.asignacionCampo.findMany({
              where: {
                empresaId: carga.empresaId,
                localId: carga.localId,
                activo: true,
                fechaDesde: { lte: fecha },
                OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
              },
              select: {
                usuarioId: true,
              },
            });
            const responsables = [
              carga.usuarioId,
              ...asignados.map((a) => a.usuarioId),
            ];
            const candidatos = new Set<number>([
              ...responsables,
              ...(await obtenerSuperioresActivos(
                tx,
                carga.empresaId,
                responsables,
              )),
            ]);
            const activos = await tx.usuario.findMany({
              where: {
                id: { in: [...candidatos] },
                empresaId: carga.empresaId,
                isActive: true,
              },
              select: { id: true },
              take: candidatos.size,
            });
            const texto = textoAvisoVencimiento(
              nombres.get(carga.itemcode) ?? carga.itemcode,
              nombreLocal(carga.local),
              carga.vencimiento,
              carga.cantidad,
              hoy,
            );
            avisos.push(
              ...activos.map((u) => ({
                empresaId: carga.empresaId,
                usuarioDestinatarioId: u.id,
                usuarioEmisorId: carga.usuarioId,
                tipo: TipoNotificacionCampo.VENCIMIENTO_PROXIMO,
                referenciaId: carga.id,
                ...texto,
              })),
            );
          }
          if (avisos.length)
            await tx.notificacionCampo.createMany({ data: avisos });
          return cargas.length;
        },
        { timeout: 30_000 },
      );
    } catch (error) {
      this.logger.error(
        'No se pudieron avisar los vencimientos',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    } finally {
      this.procesando = false;
      if (this.repetir) {
        this.repetir = false;
        void this.procesar();
      }
    }
  }
}
