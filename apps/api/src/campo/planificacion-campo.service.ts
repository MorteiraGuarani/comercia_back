import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  AsignacionCampoDto,
  BackupCampoDto,
  ConsultaCampoDto,
  HorarioCampoDto,
} from './dto/campo.dto';
import {
  ASIGNACION_CAMPO_SELECT,
  BACKUP_CAMPO_SELECT,
  HORARIO_CAMPO_SELECT,
} from './utils/selectores';
import { validarHorario, vigenciaCampo } from './utils/calendario';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class PlanificacionCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async equipo(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const buscar = query.buscar?.trim();
    const where: Prisma.UsuarioWhereInput = {
      empresaId: u.empresaId,
      superiorId: u.id,
      isActive: true,
      esSuperadmin: false,
      ...(u.rolDescripcion === 'SUPERVISOR_REPOSITORES'
        ? { rol: { descripcion: 'REPOSITOR' } }
        : {}),
      ...(buscar
        ? {
            OR: [
              { nombre: { contains: buscar, mode: 'insensitive' } },
              { apellido: { contains: buscar, mode: 'insensitive' } },
              { nombreLogin: { contains: buscar, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          rol: { select: { descripcion: true } },
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      usuarios.map((x) => ({
        id: x.id,
        nombre: `${x.nombre} ${x.apellido} · ${x.rol?.descripcion ?? 'Sin rol'}`,
      })),
      total,
      page,
      limit,
    );
  }
  async horarios(usuarioId: number, localId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const where = { localId, asignacionId: null, activo: true };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.horarioCampo.count({ where }),
      this.prisma.horarioCampo.findMany({
        where,
        select: HORARIO_CAMPO_SELECT,
        orderBy: [{ entrada: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarHorario(
    usuarioId: number,
    localId: number,
    dto: HorarioCampoDto,
    id?: number,
    asignacionId?: number,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    if (asignacionId) {
      const { a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
      if (a.localId !== localId)
        throw new NotFoundException('Asignación no disponible');
    }
    const data = { ...dto, ...vigenciaCampo(dto.fechaDesde, dto.fechaHasta) };
    validarHorario(data);
    return this.prisma.$transaction(async (tx) => {
      // Serializa cambios por local y limita el tamaño de los horarios de agenda.
      await tx.$queryRaw`SELECT id FROM campo_locales WHERE id = ${localId} FOR UPDATE`;
      if (id) {
        const anterior = await tx.horarioCampo.findFirst({
          where: {
            id,
            localId,
            asignacionId: asignacionId ?? null,
            activo: true,
          },
          select: { id: true },
        });
        if (!anterior) throw new NotFoundException('Horario no disponible');
        // Versionar conserva la referencia y el rango de las visitas históricas.
        await tx.horarioCampo.update({
          where: { id },
          data: { activo: false },
        });
      }
      if (
        (await tx.horarioCampo.count({
          where: { localId, asignacionId: asignacionId ?? null, activo: true },
        })) >= 20
      )
        throw new BadRequestException('Máximo 20 franjas activas por local');
      return tx.horarioCampo.create({
        data: { ...data, localId, asignacionId: asignacionId ?? null },
        select: HORARIO_CAMPO_SELECT,
      });
    });
  }
  async eliminarHorario(usuarioId: number, localId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const resultado = await this.prisma.horarioCampo.updateMany({
      where: { id, localId, asignacionId: null },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('Horario no disponible');
    return { ok: true };
  }
  async horariosAsignacion(
    usuarioId: number,
    asignacionId: number,
    query: ConsultaCampoDto,
  ) {
    await this.asignacionDelEquipo(usuarioId, asignacionId);
    const where = { asignacionId, activo: true };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.horarioCampo.count({ where }),
      this.prisma.horarioCampo.findMany({
        where,
        select: HORARIO_CAMPO_SELECT,
        orderBy: { entrada: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarHorarioAsignacion(
    usuarioId: number,
    asignacionId: number,
    dto: HorarioCampoDto,
    id?: number,
  ) {
    const { a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    return this.guardarHorario(usuarioId, a.localId, dto, id, asignacionId);
  }
  async eliminarHorarioAsignacion(
    usuarioId: number,
    asignacionId: number,
    id: number,
  ) {
    await this.asignacionDelEquipo(usuarioId, asignacionId);
    const resultado = await this.prisma.horarioCampo.updateMany({
      where: { id, asignacionId, activo: true },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('Horario no disponible');
    return { ok: true };
  }
  async asignaciones(
    usuarioId: number,
    localId: number,
    query: ConsultaCampoDto,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const where = {
      localId,
      activo: true,
      usuario: {
        empresaId: u.empresaId,
        superiorId: u.id,
        ...(u.rolDescripcion === 'SUPERVISOR_REPOSITORES'
          ? { rol: { descripcion: 'REPOSITOR' } }
          : {}),
      },
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.asignacionCampo.count({ where }),
      this.prisma.asignacionCampo.findMany({
        where,
        select: ASIGNACION_CAMPO_SELECT,
        orderBy: { id: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async asignar(usuarioId: number, localId: number, dto: AsignacionCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    await this.acceso.subordinado(u.empresaId, u.id, dto.usuarioId);
    const fechas = vigenciaCampo(dto.fechaDesde, dto.fechaHasta);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_locales WHERE id = ${localId} FOR UPDATE`;
      const solapa = await tx.asignacionCampo.count({
        where: {
          localId,
          usuarioId: dto.usuarioId,
          activo: true,
          fechaDesde: { lte: fechas.fechaHasta ?? new Date('9999-12-31') },
          OR: [
            { fechaHasta: null },
            { fechaHasta: { gte: fechas.fechaDesde } },
          ],
        },
      });
      if (solapa)
        throw new BadRequestException(
          'El usuario ya tiene una asignación en esas fechas',
        );
      return tx.asignacionCampo.create({
        data: { localId, usuarioId: dto.usuarioId, ...fechas },
        select: ASIGNACION_CAMPO_SELECT,
      });
    });
  }
  private async asignacionDelEquipo(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const a = await this.prisma.asignacionCampo.findFirst({
      where: {
        id,
        activo: true,
        local: { cliente: { empresaId: u.empresaId } },
        usuario: { empresaId: u.empresaId, superiorId: u.id },
      },
      select: {
        id: true,
        localId: true,
        usuarioId: true,
        fechaDesde: true,
        fechaHasta: true,
      },
    });
    if (!a) throw new NotFoundException('Asignación no disponible');
    return { u, a };
  }
  async quitarAsignacion(usuarioId: number, id: number) {
    await this.asignacionDelEquipo(usuarioId, id);
    await this.prisma.asignacionCampo.update({
      where: { id },
      data: { activo: false },
      select: { id: true },
    });
    return { ok: true };
  }
  async backups(
    usuarioId: number,
    asignacionId: number,
    query: ConsultaCampoDto,
  ) {
    await this.asignacionDelEquipo(usuarioId, asignacionId);
    const where = { asignacionId, activo: true };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.backupCampo.count({ where }),
      this.prisma.backupCampo.findMany({
        where,
        select: BACKUP_CAMPO_SELECT,
        orderBy: { fechaDesde: 'desc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async crearBackup(
    usuarioId: number,
    asignacionId: number,
    dto: BackupCampoDto,
  ) {
    const { u, a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    await this.acceso.subordinado(u.empresaId, u.id, dto.usuarioId);
    const fechas = vigenciaCampo(dto.fechaDesde, dto.fechaHasta);
    if (
      !fechas.fechaHasta ||
      dto.usuarioId === a.usuarioId ||
      fechas.fechaDesde < a.fechaDesde ||
      (a.fechaHasta && fechas.fechaHasta > a.fechaHasta)
    )
      throw new BadRequestException(
        'El backup debe ser otra persona y estar dentro de la vigencia del titular',
      );
    const hasta = fechas.fechaHasta;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_asignaciones WHERE id = ${asignacionId} FOR UPDATE`;
      if (
        await tx.backupCampo.count({
          where: {
            asignacionId,
            activo: true,
            fechaDesde: { lte: hasta },
            fechaHasta: { gte: fechas.fechaDesde },
          },
        })
      )
        throw new BadRequestException('Ya hay un backup para esas fechas');
      return tx.backupCampo.create({
        data: {
          asignacionId,
          usuarioId: dto.usuarioId,
          motivo: dto.motivo,
          fechaDesde: fechas.fechaDesde,
          fechaHasta: hasta,
        },
        select: BACKUP_CAMPO_SELECT,
      });
    });
  }
  async quitarBackup(usuarioId: number, asignacionId: number, id: number) {
    await this.asignacionDelEquipo(usuarioId, asignacionId);
    const resultado = await this.prisma.backupCampo.updateMany({
      where: { id, asignacionId },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('Backup no disponible');
    return { ok: true };
  }
}
