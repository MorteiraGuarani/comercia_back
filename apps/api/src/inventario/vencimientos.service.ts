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
    let ids: number[] = [];
    try {
      const hoy = relojCampo().fecha;
      // Reclamar con UPDATE ... RETURNING: dos instancias nunca avisan la misma carga.
      const reclamadas = await this.prisma.$queryRaw<{ id: number }[]>`
        UPDATE campo_inventario_cargas c SET avisado_en = now()
        FROM (
          SELECT DISTINCT ON (empresa_id, "CardCode", "ItemCode")
            id, empresa_id, avisado_en, cantidad, vencimiento
          FROM campo_inventario_cargas
          ORDER BY empresa_id, "CardCode", "ItemCode", fecha DESC
        ) u
        JOIN empresas e ON e.id = u.empresa_id
        WHERE c.id = u.id AND u.avisado_en IS NULL AND u.cantidad > 0
          AND u.vencimiento <= ${hoy}::date + e.dias_aviso_vencimiento
        RETURNING c.id`;
      ids = reclamadas.map((r) => r.id);
      if (!ids.length) return 0;
      const cargas = await this.prisma.cargaInventarioCampo.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          empresaId: true,
          localId: true,
          cantidad: true,
          vencimiento: true,
          usuarioId: true,
          usuario: { select: { superiorId: true } },
          local: { select: { CardCode: true, CardName: true } },
          producto: { select: { itemcode: true, itemname: true } },
        },
        take: ids.length,
      });
      const fecha = fechaCampo(hoy);
      const avisos: Prisma.NotificacionCampoCreateManyInput[] = [];
      for (const carga of cargas) {
        // Quien cargó, el personal asignado hoy al local y sus jefes directos.
        const asignados = await this.prisma.asignacionCampo.findMany({
          where: {
            empresaId: carga.empresaId,
            localId: carga.localId,
            activo: true,
            fechaDesde: { lte: fecha },
            OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
          },
          select: {
            usuarioId: true,
            usuario: { select: { superiorId: true } },
          },
          take: 50,
        });
        const candidatos = new Set<number>([
          carga.usuarioId,
          ...asignados.map((a) => a.usuarioId),
          ...[carga.usuario, ...asignados.map((a) => a.usuario)].flatMap((u) =>
            u.superiorId ? [u.superiorId] : [],
          ),
        ]);
        const activos = await this.prisma.usuario.findMany({
          where: {
            id: { in: [...candidatos] },
            empresaId: carga.empresaId,
            isActive: true,
          },
          select: { id: true },
          take: candidatos.size,
        });
        const texto = textoAvisoVencimiento(
          carga.producto.itemname ?? carga.producto.itemcode,
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
        await this.prisma.notificacionCampo.createMany({ data: avisos });
      return cargas.length;
    } catch (error) {
      // Sin notificación no queda marcada: la próxima pasada lo reintenta.
      if (ids.length)
        await this.prisma.cargaInventarioCampo
          .updateMany({ where: { id: { in: ids } }, data: { avisadoEn: null } })
          .catch(() => undefined);
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
