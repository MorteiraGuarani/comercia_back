import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampoAccesoService } from './campo-acceso.service';
import { fechaCampo, relojCampo } from './utils/calendario';
import { VISITA_CAMPO_SELECT } from './utils/selectores';
import { DestinatarioTareaCampo } from '../../generated/prisma/client';
import type {
  EntradaRepositorCampoDto,
  MarcaRepositorCampoDto,
} from './dto/campo.dto';
import type { MarcacionRepositorUcheck } from './interfaces/marcacion-repositor.interface';

@Injectable()
export class RepositorCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
    private readonly config: ConfigService,
  ) {}

  async esRepositor(usuarioId: number) {
    const usuario = await this.acceso.ejecutar(usuarioId);
    return usuario.rolDescripcion?.toUpperCase() === 'REPOSITOR';
  }

  private async enviar(datos: {
    usuarioId: number;
    asignacionId: number;
    horarioId?: number | null;
    fecha: string;
    tipo: 'ENTRADA' | 'SALIDA';
  }): Promise<MarcacionRepositorUcheck> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: datos.usuarioId },
      select: {
        correo: true,
        isActive: true,
        rol: { select: { descripcion: true } },
      },
    });
    if (!usuario?.isActive || usuario.rol?.descripcion !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const base = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      throw new ServiceUnavailableException(
        'Ucheck no está configurado para repositores',
      );
    let respuesta: Response;
    try {
      respuesta = await fetch(
        `${base.replace(/\/$/, '')}/comercia-repositor/marcar`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${secreto}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: usuario.correo,
            asignacionId: datos.asignacionId,
            horarioId: datos.horarioId ?? undefined,
            fecha: datos.fecha,
            tipo: datos.tipo,
          }),
        },
      );
    } catch {
      throw new ServiceUnavailableException('No se pudo conectar con Ucheck');
    }
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      const mensaje = Array.isArray(cuerpo?.message)
        ? cuerpo.message.join('. ')
        : cuerpo?.message;
      if (respuesta.status >= 400 && respuesta.status < 500)
        throw new BadRequestException(
          typeof mensaje === 'string' ? mensaje : 'Ucheck rechazó la marcación',
        );
      throw new ServiceUnavailableException(
        'Ucheck guardó la marcación pero aún no confirmó la sincronización',
      );
    }
    const cuerpo = (await respuesta.json()) as MarcacionRepositorUcheck;
    if (
      !Number.isSafeInteger(cuerpo.ucheckJornadaId) ||
      cuerpo.tipo !== datos.tipo
    )
      throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
    return cuerpo;
  }

  async entrada(usuarioId: number, dto: EntradaRepositorCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (u.rolDescripcion?.toUpperCase() !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const hoy = relojCampo().fecha;
    const fecha = fechaCampo(hoy);
    const asignacion = await this.prisma.asignacionCampo.findFirst({
      where: {
        id: dto.asignacionId,
        activo: true,
        fechaDesde: { lte: fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
          { OR: [
            { usuarioId, backups: { none: {
              activo: true, fechaDesde: { lte: fecha }, fechaHasta: { gte: fecha },
            } } },
            { backups: { some: {
              usuarioId, activo: true,
              fechaDesde: { lte: fecha }, fechaHasta: { gte: fecha },
            } } },
          ] },
        ],
        local: {
          activo: true,
          cliente: { empresaId: u.empresaId, activo: true },
        },
      },
      select: { id: true },
    });
    if (!asignacion) throw new NotFoundException('Asignación no disponible');
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: dto.asignacionId,
      horarioId: dto.horarioId,
      fecha: hoy,
      tipo: 'ENTRADA',
    });
    const visita = await this.prisma.visitaCampo.findFirst({
      where: { ucheckJornadaId: resultado.ucheckJornadaId, usuarioId },
      select: VISITA_CAMPO_SELECT,
    });
    if (!visita)
      throw new ServiceUnavailableException(
        'La entrada está sincronizándose; actualizá la ruta',
      );
    if (dto.nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaEntrada: dto.nota },
        select: { id: true },
      });
    return visita;
  }

  async salida(
    usuarioId: number,
    visitaId: number,
    dto: MarcaRepositorCampoDto,
  ) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (u.rolDescripcion?.toUpperCase() !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        id: visitaId,
        usuarioId,
        salida: null,
        origen: 'UCHECK',
        local: { cliente: { empresaId: u.empresaId } },
      },
      select: {
        id: true,
        localId: true,
        asignacionId: true,
        horarioId: true,
        fecha: true,
        ucheckJornadaId: true,
      },
    });
    if (!visita?.ucheckJornadaId)
      throw new NotFoundException('Visita abierta no disponible');
    const pendientes = await this.prisma.tareaCampo.count({
      where: {
        empresaId: u.empresaId,
        activo: true,
        destinatario: {
          in: [DestinatarioTareaCampo.REPOSITOR, DestinatarioTareaCampo.AMBOS],
        },
        fechaDesde: { lte: visita.fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: visita.fecha } }] },
          {
            OR: [
              { todosLocales: true },
              { locales: { some: { localId: visita.localId } } },
            ],
          },
        ],
        cumplimientos: {
          none: { visitaId: visita.id, NOT: { completadaAt: null } },
        },
      },
    });
    if (pendientes)
      throw new BadRequestException(
        `Completá las ${pendientes} tareas pendientes antes de salir`,
      );
    await this.enviar({
      usuarioId,
      asignacionId: visita.asignacionId,
      horarioId: visita.horarioId,
      fecha: visita.fecha.toISOString().slice(0, 10),
      tipo: 'SALIDA',
    });
    if (dto.nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaSalida: dto.nota },
        select: { id: true },
      });
    return { ok: true };
  }
}
