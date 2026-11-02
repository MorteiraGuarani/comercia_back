import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import type { UsuarioUcheckSincronizado } from './interfaces/usuario-ucheck-sincronizado.interface';
import { programasUcheck } from './utils/programas-ucheck';

const INTERVALO_MS = 60_000;
const POR_VUELTA = 20;
const VUELTAS_MAXIMAS = 10;

/**
 * Lleva a Ucheck el alta, la edición y la baja de cada usuario del ABM: su
 * cuenta (baja lógica, sin borrar historial) y sus programas COMERCIA,
 * COMERCIA_TEAMLEADER, COMERCIA_REPOSITOR y SEGUIMIENTO. El cambio queda en
 * `ucheck_usuarios_pendientes` y se manda enseguida; si Ucheck no responde se
 * reintenta cada minuto con espera creciente (hasta 1 h) sin perderlo. Se
 * manda siempre el estado actual completo: repetirlo no duplica nada.
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
   */
  async marcar(usuarioId: number, ucheckUsuarioId?: number) {
    await this.prisma.ucheckUsuarioPendiente.upsert({
      where: { usuarioId },
      create: { usuarioId, ucheckUsuarioId },
      update: {
        version: { increment: 1 },
        ...(ucheckUsuarioId ? { ucheckUsuarioId } : {}),
        intentos: 0,
        siguienteIntento: new Date(),
        ultimoError: null,
      },
      select: { usuarioId: true },
    });
    void this.sincronizar();
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
    intentos: number;
  }) {
    try {
      await this.enviarEstado(p.usuarioId, p.ucheckUsuarioId);
      // Si lo editaron durante el envío, la versión cambió y queda para la próxima vuelta.
      await this.prisma.ucheckUsuarioPendiente.deleteMany({
        where: { usuarioId: p.usuarioId, version: p.version },
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

  private async enviarEstado(
    usuarioId: number,
    vinculoAnterior: number | null,
  ) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        correo: true,
        nombre: true,
        apellido: true,
        celular: true,
        legajo: true,
        isActive: true,
        esSuperadmin: true,
        permitirVinculoAutomatico: true,
        empresa: { select: { nombre: true } },
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: { tipo: true, activo: true } },
          },
        },
        identidadUcheck: { select: { ucheckUsuarioId: true } },
      },
    });
    if (!u || u.esSuperadmin || u.correo.endsWith('.invalid')) return;
    const ucheckUsuarioId =
      u.identidadUcheck?.ucheckUsuarioId ?? vinculoAnterior ?? undefined;
    const programas = programasUcheck(u.rol);
    // Solo el equipo de campo se crea en Ucheck; el resto se actualiza si ya
    // estaba vinculado. Una cuenta desvinculada a mano no se vuelve a vincular.
    if (!ucheckUsuarioId && (!programas.length || !u.permitirVinculoAutomatico))
      return;
    const r = await this.ucheck.pedir<UsuarioUcheckSincronizado>(
      '/comercia-integracion/usuarios',
      {
        method: 'PUT',
        body: {
          ucheckUsuarioId,
          correo: u.correo,
          nombre: (`${u.nombre} ${u.apellido}`.trim() || u.correo).slice(
            0,
            200,
          ),
          telefono: u.celular || undefined,
          legajo: u.legajo,
          empresa: u.empresa.nombre,
          activo: u.isActive,
          programas,
        },
      },
    );
    await this.prisma.identidadUcheck.upsert({
      where: { usuarioId },
      create: {
        usuarioId,
        ucheckUsuarioId: r.ucheckUsuarioId,
        correoVinculado: r.correo,
      },
      update: { correoVinculado: r.correo },
      select: { id: true },
    });
  }
}
