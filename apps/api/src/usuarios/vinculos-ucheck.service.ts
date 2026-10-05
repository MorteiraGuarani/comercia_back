import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { IdentidadUcheckAdmin } from './interfaces/identidad-ucheck-admin.interface';

@Injectable()
export class VinculosUcheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private async autorizar(actorId: number, usuarioId: number) {
    const actor = await this.prisma.usuario.findUnique({
      where: { id: actorId },
      select: { esSuperadmin: true, isActive: true },
    });
    if (!actor?.isActive || !actor.esSuperadmin)
      throw new ForbiddenException('Requiere superadministrador');
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        correo: true,
        isActive: true,
        rol: {
          select: { equipoCampo: { select: { tipo: true, activo: true } } },
        },
        identidadUcheck: {
          select: {
            ucheckUsuarioId: true,
            correoVinculado: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!u) throw new NotFoundException('Cuenta no disponible');
    return u;
  }
  private async identidad(
    query: Record<string, string>,
  ): Promise<IdentidadUcheckAdmin> {
    const base = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      throw new ServiceUnavailableException('Ucheck no está configurado');
    try {
      const r = await fetch(
        `${base.replace(/\/$/, '')}/comercia-repositor/identidad?${new URLSearchParams(query)}`,
        {
          headers: { Authorization: `Bearer ${secreto}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.status === 404)
        throw new NotFoundException('No se encontró esta cuenta en Ucheck');
      if (!r.ok)
        throw new ServiceUnavailableException(
          'Ucheck no pudo comprobar la cuenta',
        );
      const d = (await r.json()) as IdentidadUcheckAdmin;
      if (
        !Number.isSafeInteger(d.id) ||
        d.id < 1 ||
        typeof d.nombre !== 'string' ||
        typeof d.correo !== 'string' ||
        !Array.isArray(d.programas) ||
        !d.programas.every((p) => typeof p === 'string') ||
        typeof d.activa !== 'boolean'
      )
        throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
      return {
        id: d.id,
        nombre: d.nombre,
        correo: d.correo,
        activa: d.activa,
        empresa: typeof d.empresa === 'string' ? d.empresa : null,
        programas: d.programas,
      };
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof ServiceUnavailableException
      )
        throw e;
      throw new ServiceUnavailableException('No se pudo conectar con Ucheck');
    }
  }
  async consultar(actorId: number, usuarioId: number) {
    const u = await this.autorizar(actorId, usuarioId);
    let candidata: IdentidadUcheckAdmin | null = null;
    let error: string | null = null;
    try {
      candidata = await this.identidad(
        u.identidadUcheck
          ? { ucheckUsuarioId: String(u.identidadUcheck.ucheckUsuarioId) }
          : { correo: u.correo },
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'No se pudo comprobar Ucheck';
    }
    return {
      usuarioId: u.id,
      correo: u.correo,
      vinculo: u.identidadUcheck,
      candidata,
      error,
    };
  }
  async vincular(actorId: number, usuarioId: number, ucheckUsuarioId: number) {
    const u = await this.autorizar(actorId, usuarioId);
    const candidata = await this.identidad({
      ucheckUsuarioId: String(ucheckUsuarioId),
    });
    if (!u.isActive || !u.rol?.equipoCampo?.activo || !candidata.activa)
      throw new BadRequestException(
        'Las cuentas y el equipo operativo deben estar activos',
      );
    const programas =
      u.rol.equipoCampo.tipo === 'REPOSITOR'
        ? ['COMERCIA_REPOSITOR']
        : ['COMERCIA', 'COMERCIA_TEAMLEADER'];
    if (!programas.some((p) => candidata.programas.includes(p)))
      throw new BadRequestException(
        'Habilitá el programa de campo correspondiente en Ucheck',
      );
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
        const actual = await tx.identidadUcheck.findUnique({
          where: { usuarioId },
          select: { ucheckUsuarioId: true },
        });
        if (actual && actual.ucheckUsuarioId !== ucheckUsuarioId)
          throw new ConflictException(
            'Desvinculá primero la identidad anterior',
          );
        await tx.identidadUcheck.upsert({
          where: { usuarioId },
          create: {
            usuarioId,
            ucheckUsuarioId,
            correoVinculado: candidata.correo,
          },
          update: { correoVinculado: candidata.correo },
          select: { id: true },
        });
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { permitirVinculoAutomatico: true },
          select: { id: true },
        });
      });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002')
        throw new ConflictException(
          'Esta identidad ya está vinculada a otra cuenta',
        );
      throw e;
    }
    return this.consultar(actorId, usuarioId);
  }
  async desvincular(actorId: number, usuarioId: number) {
    await this.autorizar(actorId, usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
      if (await tx.visitaCampo.count({ where: { usuarioId, salida: null } }))
        throw new BadRequestException(
          'Cerrá las visitas abiertas antes de desvincular Ucheck',
        );
      if (
        await tx.operacionCampo.count({
          where: { usuarioId, estado: 'PENDIENTE' },
        })
      )
        throw new BadRequestException(
          'Resolvé las marcaciones pendientes antes de desvincular Ucheck',
        );
      await tx.usuario.update({
        where: { id: usuarioId },
        data: { permitirVinculoAutomatico: false },
        select: { id: true },
      });
      await tx.identidadUcheck.deleteMany({ where: { usuarioId } });
      await tx.seguimientoCampo.deleteMany({ where: { usuarioId } });
    });
    return { ok: true };
  }
}
