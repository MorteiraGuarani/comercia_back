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
import { exigirEquipoCampo, EQUIPO_CAMPO_SELECT } from './utils/equipo-campo';
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
    return exigirEquipoCampo(usuario.equipoCampo).tipo === 'REPOSITOR';
  }

  async estadoTelefono(usuarioId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Estado no disponible');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        correo: true,
        permitirVinculoAutomatico: true,
        identidadUcheck: { select: { ucheckUsuarioId: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Cuenta no disponible');
    if (!usuario.permitirVinculoAutomatico && !usuario.identidadUcheck)
      return {
        estado: 'NO_HABILITADO',
        mensaje:
          'Un administrador debe volver a vincular esta cuenta con Ucheck',
      };
    const base = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      return {
        estado: 'SIN_CONEXION',
        mensaje: 'Ucheck no está configurado para consultar el teléfono',
      };
    try {
      const query = new URLSearchParams(
        usuario.identidadUcheck
          ? { ucheckUsuarioId: String(usuario.identidadUcheck.ucheckUsuarioId) }
          : { correo: usuario.correo },
      );
      const r = await fetch(
        `${base.replace(/\/$/, '')}/comercia-repositor/estado?${query}`,
        {
          headers: { Authorization: `Bearer ${secreto}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.status === 404)
        return {
          estado: 'NO_HABILITADO',
          mensaje:
            'La cuenta aún no está vinculada a un repositor activo en Ucheck',
        };
      if (!r.ok) throw new Error('Consulta rechazada');
      const data = (await r.json()) as {
        habilitado?: boolean;
        seguimientoActivo?: boolean;
        ubicacionReciente?: boolean;
        capturadaEn?: string | null;
        precisionMetros?: number | null;
      };
      if (!data.habilitado)
        return {
          estado: 'NO_HABILITADO',
          mensaje:
            'El programa Repositor no está habilitado para esta cuenta en Ucheck',
        };
      if (data.ubicacionReciente)
        return {
          estado: 'LISTO',
          mensaje: 'Ubicación reciente recibida de Ucheck',
          capturadaEn: data.capturadaEn ?? null,
          precisionMetros: data.precisionMetros ?? null,
        };
      return {
        estado: data.seguimientoActivo
          ? 'DESACTUALIZADO'
          : 'SEGUIMIENTO_DETENIDO',
        mensaje: data.seguimientoActivo
          ? 'Abrí Ucheck y tocá Actualizar ubicación'
          : 'Iniciá el seguimiento laboral en Ucheck para marcar en Comercia',
        capturadaEn: data.capturadaEn ?? null,
      };
    } catch {
      return {
        estado: 'SIN_CONEXION',
        mensaje:
          'No se pudo consultar Ucheck. No se confirmó el estado del teléfono',
      };
    }
  }

  private async enviar(datos: {
    usuarioId: number;
    asignacionId: number;
    horarioId?: number | null;
    fecha: string;
    tipo: 'ENTRADA' | 'SALIDA';
    nota?: string;
  }): Promise<MarcacionRepositorUcheck> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: datos.usuarioId },
      select: {
        correo: true,
        identidadUcheck: { select: { ucheckUsuarioId: true } },
        permitirVinculoAutomatico: true,
        isActive: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
    });
    if (
      !usuario?.isActive ||
      usuario.rol?.equipoCampo?.tipo !== 'REPOSITOR' ||
      !usuario.rol.equipoCampo.activo
    )
      throw new ForbiddenException('Marcación no disponible');
    if (!usuario.permitirVinculoAutomatico && !usuario.identidadUcheck)
      throw new ForbiddenException(
        'Un administrador debe volver a vincular esta cuenta con Ucheck',
      );
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
            ucheckUsuarioId: usuario.identidadUcheck?.ucheckUsuarioId,
            asignacionId: datos.asignacionId,
            horarioId: datos.horarioId ?? undefined,
            fecha: datos.fecha,
            tipo: datos.tipo,
          }),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo conectar con Ucheck para confirmar la operación. Consultá la visita y reintentá; los reintentos no duplican la marcación',
      );
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
        'Ucheck no pudo confirmar el resultado de la operación. Revisá la visita antes de reintentar',
      );
    }
    const cuerpo = (await respuesta.json()) as MarcacionRepositorUcheck;
    if (
      !Number.isSafeInteger(cuerpo.ucheckJornadaId) ||
      cuerpo.ucheckJornadaId < 1 ||
      cuerpo.tipo !== datos.tipo ||
      (cuerpo.estado !== undefined &&
        !['PENDIENTE', 'CONFIRMADA'].includes(cuerpo.estado)) ||
      (cuerpo.estado === 'PENDIENTE' && !cuerpo.operacionId)
    )
      throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
    if (cuerpo.operacionId) {
      if (!/^rep-[a-f0-9]{48}$/.test(cuerpo.operacionId))
        throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
      const operacionId = cuerpo.operacionId;
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${cuerpo.ucheckJornadaId})`;
        const anterior = await tx.operacionCampo.findUnique({
          where: { id: operacionId },
          select: { usuarioId: true },
        });
        if (anterior && anterior.usuarioId !== datos.usuarioId)
          throw new ServiceUnavailableException(
            'Operación de Ucheck no disponible',
          );
        const visita = await tx.visitaCampo.findFirst({
          where: {
            usuarioId: datos.usuarioId,
            ucheckJornadaId: cuerpo.ucheckJornadaId,
          },
          select: { id: true, salida: true },
        });
        const estado =
          visita && (datos.tipo === 'ENTRADA' || visita.salida)
            ? 'CONFIRMADA'
            : 'PENDIENTE';
        await tx.operacionCampo.upsert({
          where: { id: operacionId },
          create: {
            id: operacionId,
            usuarioId: datos.usuarioId,
            ucheckJornadaId: cuerpo.ucheckJornadaId,
            tipo: datos.tipo,
            estado,
            nota: datos.nota ?? '',
          },
          update: { estado, nota: datos.nota },
          select: { id: true },
        });
        if (estado === 'CONFIRMADA' && visita && datos.nota)
          await tx.visitaCampo.update({
            where: { id: visita.id },
            data:
              datos.tipo === 'ENTRADA'
                ? { notaEntrada: datos.nota }
                : { notaSalida: datos.nota },
            select: { id: true },
          });
        cuerpo.estado = estado;
      });
    }
    return cuerpo;
  }

  async estadoOperacion(usuarioId: number, id: string) {
    if (!/^rep-[a-f0-9]{48}$/.test(id))
      throw new BadRequestException('Identificador de operación inválido');
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Operación no disponible');
    const op = await this.prisma.operacionCampo.findFirst({
      where: { id, usuarioId },
      select: { ucheckJornadaId: true, tipo: true, nota: true },
    });
    if (!op) throw new NotFoundException('Operación no disponible');
    const visita = await this.prisma.visitaCampo.findFirst({
      where: { usuarioId, ucheckJornadaId: op.ucheckJornadaId },
      select: { id: true, salida: true },
    });
    if (visita && (op.tipo === 'ENTRADA' || visita.salida)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.operacionCampo.update({
          where: { id },
          data: { estado: 'CONFIRMADA' },
          select: { id: true },
        });
        if (op.nota)
          await tx.visitaCampo.update({
            where: { id: visita.id },
            data:
              op.tipo === 'ENTRADA'
                ? { notaEntrada: op.nota }
                : { notaSalida: op.nota },
            select: { id: true },
          });
      });
      return { estado: 'CONFIRMADA', mensaje: 'Marcación confirmada' };
    }
    return {
      estado: 'PENDIENTE',
      mensaje:
        'Marcación guardada en Ucheck, pendiente de sincronización. La confirmación se consulta sin crear otra marcación.',
    };
  }

  async entrada(usuarioId: number, dto: EntradaRepositorCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const hoy = relojCampo().fecha;
    const fecha = fechaCampo(hoy);
    const asignacion = await this.prisma.asignacionCampo.findFirst({
      where: {
        id: dto.asignacionId,
        usuario: {
          rol: { equipoCampoId: exigirEquipoCampo(u.equipoCampo).id },
        },
        activo: true,
        fechaDesde: { lte: fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
          {
            OR: [
              {
                usuarioId,
                backups: {
                  none: {
                    activo: true,
                    fechaDesde: { lte: fecha },
                    fechaHasta: { gte: fecha },
                  },
                },
              },
              {
                backups: {
                  some: {
                    usuarioId,
                    activo: true,
                    fechaDesde: { lte: fecha },
                    fechaHasta: { gte: fecha },
                  },
                },
              },
            ],
          },
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
      nota: dto.nota,
    });
    const visita = await this.prisma.visitaCampo.findFirst({
      where: { ucheckJornadaId: resultado.ucheckJornadaId, usuarioId },
      select: VISITA_CAMPO_SELECT,
    });
    if (!visita && resultado.estado === 'PENDIENTE') return resultado;
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
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
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
        destinatario: DestinatarioTareaCampo.REPOSITOR,
        equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        OR: [
          {
            activo: true,
            fechaDesde: { lte: visita.fecha },
            AND: [
              {
                OR: [
                  { fechaHasta: null },
                  { fechaHasta: { gte: visita.fecha } },
                ],
              },
              {
                OR: [
                  { todosLocales: true },
                  { locales: { some: { localId: visita.localId } } },
                ],
              },
            ],
          },
          {
            cumplimientos: {
              some: { visitaId: visita.id, completadaAt: null },
            },
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
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: visita.asignacionId,
      horarioId: visita.horarioId,
      fecha: visita.fecha.toISOString().slice(0, 10),
      tipo: 'SALIDA',
      nota: dto.nota,
    });
    if (resultado.estado === 'PENDIENTE') return resultado;
    if (dto.nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaSalida: dto.nota },
        select: { id: true },
      });
    return { ok: true };
  }
}
