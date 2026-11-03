import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  rangoPaginacion,
  respuestaPaginada,
  type PaginacionDto,
} from '../common/utils/paginacion';
import { PrismaService } from '../prisma/prisma.service';
import { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import type {
  ProgramasUcheckPagina,
  UsuarioUcheckSincronizado,
} from './interfaces/usuario-ucheck-sincronizado.interface';

const INTERVALO_MS = 60_000;
const POR_VUELTA = 20;
const VUELTAS_MAXIMAS = 10;
// Mismo formato que el usuario único de Ucheck; otro se deja sin mandar.
const USUARIO_UCHECK = /^[a-z0-9._-]{3,64}$/;

/**
 * Lleva a Ucheck el alta, la edición y la baja de cada usuario del ABM: su
 * cuenta (usuario único, datos y baja lógica, sin borrar historial) y los
 * programas elegidos en el ABM. Lo que Ucheck confirma vuelve como copia a
 * `usuarios.programas_ucheck`. El cambio queda en `ucheck_usuarios_pendientes`
 * y se manda enseguida; si Ucheck no responde se reintenta cada minuto con
 * espera creciente (hasta 1 h) sin perderlo. Se manda el estado actual
 * completo: repetirlo no duplica nada.
 */
@Injectable()
export class UcheckUsuariosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UcheckUsuariosService.name);
  private intervalo?: NodeJS.Timeout;
  private enCurso?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ucheck: UcheckClienteService,
  ) {}

  onModuleInit() {
    if (!this.ucheck.configurado()) return;
    this.intervalo = setInterval(() => void this.sincronizar(), INTERVALO_MS);
    this.intervalo.unref();
  }

  onModuleDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  /**
   * Anota que el usuario cambió y lo manda sin demorar la respuesta del ABM.
   * `ucheckUsuarioId`: la cuenta que tenía vinculada antes de cambiar el correo.
   * `programas`: los elegidos en el ABM; se guardan y se mandan a Ucheck.
   */
  async marcar(
    usuarioId: number,
    opciones: { ucheckUsuarioId?: number; programas?: string[] } = {},
  ) {
    const { ucheckUsuarioId, programas } = opciones;
    // Junto con la versión: una copia vieja que vuelve de Ucheck no pisa la elección.
    await this.prisma.$transaction(async (tx) => {
      if (programas)
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { programasUcheck: programas },
          select: { id: true },
        });
      await tx.ucheckUsuarioPendiente.upsert({
        where: { usuarioId },
        create: { usuarioId, ucheckUsuarioId, programas: !!programas },
        update: {
          version: { increment: 1 },
          ...(ucheckUsuarioId ? { ucheckUsuarioId } : {}),
          ...(programas ? { programas: true } : {}),
          intentos: 0,
          siguienteIntento: new Date(),
          ultimoError: null,
        },
        select: { usuarioId: true },
      });
    });
    void this.sincronizar();
  }

  /** Catálogo de programas de Ucheck que se pueden asignar en la empresa. */
  async programas(empresa: string, query: PaginacionDto) {
    const { page, limit } = rangoPaginacion(query);
    const r = await this.ucheck.pedir<ProgramasUcheckPagina>(
      '/comercia-integracion/programas',
      {
        query: {
          empresa,
          pagina: String(page),
          tamanoPagina: String(limit),
        },
        espera: 5000,
      },
    );
    return respuestaPaginada(
      r.programas.map((p) => ({ id: p.codigo, nombre: p.nombre })),
      r.paginacion.total,
      page,
      limit,
    );
  }

  /** Una sola vuelta a la vez: quien llega durante una, la espera. */
  sincronizar(): Promise<void> {
    this.enCurso ??= this.ejecutar()
      .catch((e: unknown) =>
        this.logger.warn(
          `No se pudieron llevar usuarios a Ucheck: ${String(e)}`,
        ),
      )
      .finally(() => (this.enCurso = undefined));
    return this.enCurso;
  }

  private async ejecutar() {
    if (!this.ucheck.configurado()) return;
    for (let vuelta = 0; vuelta < VUELTAS_MAXIMAS; vuelta++) {
      const pendientes = await this.prisma.ucheckUsuarioPendiente.findMany({
        where: { siguienteIntento: { lte: new Date() } },
        select: {
          usuarioId: true,
          version: true,
          ucheckUsuarioId: true,
          programas: true,
          intentos: true,
        },
        orderBy: { siguienteIntento: 'asc' },
        take: POR_VUELTA,
      });
      if (!pendientes.length) return;
      for (const p of pendientes) await this.enviar(p);
    }
  }

  private async enviar(p: {
    usuarioId: number;
    version: number;
    ucheckUsuarioId: number | null;
    programas: boolean;
    intentos: number;
  }) {
    try {
      const r = await this.enviarEstado(p);
      await this.prisma.$transaction(async (tx) => {
        // Bloquea al usuario antes de mirar la versión: marcar() escribe en el mismo orden.
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${p.usuarioId} FOR UPDATE`;
        // Si lo editaron durante el envío, queda para la próxima vuelta.
        const vigente = await tx.ucheckUsuarioPendiente.count({
          where: { usuarioId: p.usuarioId, version: p.version },
        });
        if (!vigente) return;
        if (r) {
          await tx.usuario.update({
            where: { id: p.usuarioId },
            data: { programasUcheck: r.programas },
            select: { id: true },
          });
          await tx.identidadUcheck.upsert({
            where: { usuarioId: p.usuarioId },
            create: {
              usuarioId: p.usuarioId,
              ucheckUsuarioId: r.ucheckUsuarioId,
              correoVinculado: r.correo,
            },
            update: { correoVinculado: r.correo },
            select: { id: true },
          });
        }
        await tx.ucheckUsuarioPendiente.delete({
          where: { usuarioId: p.usuarioId },
        });
      });
    } catch (error: unknown) {
      const intentos = p.intentos + 1;
      const mensaje = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 500);
      await this.prisma.ucheckUsuarioPendiente.updateMany({
        where: { usuarioId: p.usuarioId, version: p.version },
        data: {
          intentos,
          ultimoError: mensaje,
          siguienteIntento: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** (intentos - 1)) * 1000,
          ),
        },
      });
      this.logger.warn(
        `Ucheck no tomó el usuario ${p.usuarioId} (intento ${intentos}): ${mensaje}`,
      );
    }
  }

  /** Manda el estado actual; null si no corresponde mandarlo a Ucheck. */
  private async enviarEstado(p: {
    usuarioId: number;
    ucheckUsuarioId: number | null;
    programas: boolean;
  }) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: p.usuarioId },
      select: {
        correo: true,
        nombreLogin: true,
        nombre: true,
        apellido: true,
        celular: true,
        legajo: true,
        isActive: true,
        esSuperadmin: true,
        permitirVinculoAutomatico: true,
        programasUcheck: true,
        empresa: { select: { nombre: true } },
        identidadUcheck: { select: { ucheckUsuarioId: true } },
      },
    });
    if (!u || u.esSuperadmin || u.correo.endsWith('.invalid')) return null;
    const ucheckUsuarioId =
      u.identidadUcheck?.ucheckUsuarioId ?? p.ucheckUsuarioId ?? undefined;
    // Solo se crea en Ucheck quien tiene programas elegidos; el resto se
    // actualiza si ya estaba vinculado. Una cuenta desvinculada a mano no se
    // vuelve a vincular.
    if (
      !ucheckUsuarioId &&
      (!u.programasUcheck.length || !u.permitirVinculoAutomatico)
    )
      return null;
    return this.ucheck.pedir<UsuarioUcheckSincronizado>(
      '/comercia-integracion/usuarios',
      {
        method: 'PUT',
        body: {
          ucheckUsuarioId,
          correo: u.correo,
          nombreUsuario: USUARIO_UCHECK.test(u.nombreLogin)
            ? u.nombreLogin
            : undefined,
          nombre: (`${u.nombre} ${u.apellido}`.trim() || u.correo).slice(
            0,
            200,
          ),
          telefono: u.celular || undefined,
          legajo: u.legajo,
          empresa: u.empresa.nombre,
          activo: u.isActive,
          // Sin cambio de programas en el ABM, Ucheck conserva los suyos y
          // devuelve la copia.
          programas:
            p.programas || !ucheckUsuarioId ? u.programasUcheck : undefined,
        },
      },
    );
  }
}
