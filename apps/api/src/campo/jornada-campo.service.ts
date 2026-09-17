import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  ConsultaCampoDto,
  EntradaCampoDto,
  MarcaCampoDto,
} from './dto/campo.dto';
import { fechaCampo, ocurreHorario, relojCampo } from './utils/calendario';
import { condicionAgenda } from './utils/agenda-sql';
import {
  HORARIO_CAMPO_SELECT,
  LOCAL_CAMPO_SELECT,
  VISITA_CAMPO_SELECT,
} from './utils/selectores';
import type {
  FilaAgendaId,
  TotalAgenda,
} from './interfaces/calendario.interface';

@Injectable()
export class JornadaCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  private async asignacionEfectiva(
    tx: Prisma.TransactionClient,
    empresaId: number,
    usuarioId: number,
    id: number,
    fecha: Date,
  ) {
    const a = await tx.asignacionCampo.findFirst({
      where: {
        id,
        activo: true,
        fechaDesde: { lte: fecha },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
        local: { activo: true, cliente: { empresaId, activo: true } },
      },
      select: {
        id: true,
        localId: true,
        usuarioId: true,
        backups: {
          where: {
            activo: true,
            fechaDesde: { lte: fecha },
            fechaHasta: { gte: fecha },
          },
          take: 1,
          select: { usuarioId: true },
        },
      },
    });
    if (!a || (a.backups[0]?.usuarioId ?? a.usuarioId) !== usuarioId)
      throw new NotFoundException('Asignación no disponible para esta fecha');
    return a;
  }
  async agenda(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const fechaTexto = query.fecha ?? relojCampo().fecha;
    const fecha = fechaCampo(fechaTexto);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const condicion = condicionAgenda(u.empresaId, u.id, fechaTexto);
    const base = Prisma.sql`FROM campo_asignaciones a JOIN campo_locales l ON l.id = a.local_id JOIN campo_clientes c ON c.id = l.cliente_id WHERE ${condicion}`;
    const [conteo, ids] = await Promise.all([
      this.prisma.$queryRaw<TotalAgenda[]>(
        Prisma.sql`SELECT COUNT(*) AS total ${base}`,
      ),
      this.prisma.$queryRaw<FilaAgendaId[]>(
        Prisma.sql`SELECT a.id ${base} ORDER BY l.nombre, a.id LIMIT ${take} OFFSET ${skip}`,
      ),
    ]);
    const filas = await this.prisma.asignacionCampo.findMany({
      where: { id: { in: ids.map((x) => x.id) } },
      take,
      select: {
        id: true,
        usuarioId: true,
        usuario: { select: { nombre: true, apellido: true } },
        local: {
          select: {
            ...LOCAL_CAMPO_SELECT,
            horarios: {
              where: { activo: true },
              take: 20,
              orderBy: { entrada: 'asc' },
              select: HORARIO_CAMPO_SELECT,
            },
          },
        },
        visitas: {
          where: { usuarioId, fecha },
          take: 21,
          select: { id: true, horarioId: true, entrada: true, salida: true },
        },
      },
    });
    const porId = new Map(filas.map((f) => [f.id, f]));
    const items = ids.flatMap(({ id }) => {
      const a = porId.get(id);
      return a
        ? [
            {
              id: a.id,
              esBackup: a.usuarioId !== u.id,
              titular: `${a.usuario.nombre} ${a.usuario.apellido}`,
              local: {
                ...a.local,
                horarios: a.local.horarios.filter((h) =>
                  ocurreHorario(h, fecha),
                ),
              },
              visitas: a.visitas,
            },
          ]
        : [];
    });
    return respuestaPaginada(items, Number(conteo[0].total), page, limit);
  }
  private validarMarca(dto: MarcaCampoDto) {
    if ((dto.latitud == null) !== (dto.longitud == null))
      throw new BadRequestException('Enviá ambas coordenadas');
    if (dto.latitud == null && dto.nota.trim().length < 3)
      throw new BadRequestException('Indicá el motivo de marcar sin ubicación');
  }
  async entrada(usuarioId: number, dto: EntradaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    this.validarMarca(dto);
    const ahora = new Date();
    const reloj = relojCampo(ahora);
    const fecha = fechaCampo(reloj.fecha);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuarioId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM campo_asignaciones WHERE id = ${dto.asignacionId} FOR UPDATE`;
        const a = await this.asignacionEfectiva(
          tx,
          u.empresaId,
          u.id,
          dto.asignacionId,
          fecha,
        );
        if (await tx.visitaCampo.count({ where: { usuarioId, salida: null } }))
          throw new ConflictException(
            'Cerrá tu visita abierta antes de marcar otra entrada',
          );
        const horarios = await tx.horarioCampo.findMany({
          where: { localId: a.localId, activo: true },
          select: HORARIO_CAMPO_SELECT,
          take: 20,
        });
        if (horarios.length) {
          const h = horarios.find((x) => x.id === dto.horarioId);
          if (
            !h ||
            !ocurreHorario(h, fecha) ||
            reloj.hora < h.entrada ||
            reloj.hora >= h.salida
          )
            throw new BadRequestException(
              'La entrada debe estar dentro de una franja de atención de hoy',
            );
        } else if (dto.horarioId != null)
          throw new BadRequestException('Horario no disponible');
        return tx.visitaCampo.create({
          data: {
            localId: a.localId,
            asignacionId: a.id,
            usuarioId: u.id,
            horarioId: dto.horarioId ?? null,
            fecha,
            entrada: ahora,
            esBackup: a.usuarioId !== u.id,
            entradaLat: dto.latitud,
            entradaLng: dto.longitud,
            notaEntrada: dto.nota,
          },
          select: VISITA_CAMPO_SELECT,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Ya se registró esta visita');
      throw error;
    }
  }
  async abierta(usuarioId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    // Se puede cerrar aunque un responsable cambie la asignación o el horario.
    return this.prisma.visitaCampo.findFirst({
      where: {
        usuarioId: u.id,
        salida: null,
        local: { cliente: { empresaId: u.empresaId } },
      },
      select: VISITA_CAMPO_SELECT,
    });
  }
  async salida(usuarioId: number, id: number, dto: MarcaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    this.validarMarca(dto);
    const resultado = await this.prisma.visitaCampo.updateMany({
      where: {
        id,
        usuarioId: u.id,
        salida: null,
        local: { cliente: { empresaId: u.empresaId } },
      },
      data: {
        salida: new Date(),
        salidaLat: dto.latitud,
        salidaLng: dto.longitud,
        notaSalida: dto.nota,
      },
    });
    if (!resultado.count)
      throw new NotFoundException('Visita abierta no disponible');
    return { ok: true };
  }
  async tareas(
    usuarioId: number,
    asignacionId: number,
    query: ConsultaCampoDto,
  ) {
    const u = await this.acceso.ejecutar(usuarioId);
    const fecha = fechaCampo(query.fecha ?? relojCampo().fecha);
    const a = await this.asignacionEfectiva(
      this.prisma,
      u.empresaId,
      u.id,
      asignacionId,
      fecha,
    );
    const where: Prisma.TareaCampoWhereInput = {
      empresaId: u.empresaId,
      activo: true,
      fechaDesde: { lte: fecha },
      AND: [
        { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
        {
          OR: [
            { todosLocales: true },
            { locales: { some: { localId: a.localId } } },
          ],
        },
      ],
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.tareaCampo.count({ where }),
      this.prisma.tareaCampo.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          requiereFotos: true,
          fotosObligatorias: true,
          categoria: true,
          esObligatoria: true,
          cumplimientos: {
            // Incluye borradores para que el impulsador pueda ver las
            // evidencias cargadas antes de completar la tarea.
            where: { visita: { usuarioId, asignacionId, fecha } },
            take: 21,
            select: {
              visitaId: true,
              completadaAt: true,
              fotos: { select: { momento: true }, take: 2 },
            },
          },
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      items.map(({ cumplimientos, ...t }) => ({
        ...t,
        visitasCompletadas: cumplimientos
          .filter((c) => c.completadaAt !== null)
          .map((c) => c.visitaId),
        tieneAntes: cumplimientos.some((c) =>
          c.fotos.some((foto) => foto.momento === 'ANTES'),
        ),
        tieneDespues: cumplimientos.some((c) =>
          c.fotos.some((foto) => foto.momento === 'DESPUES'),
        ),
      })),
      total,
      page,
      limit,
    );
  }
  async completar(usuarioId: number, visitaId: number, tareaId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_visitas WHERE id = ${visitaId} FOR UPDATE`;
      const v = await tx.visitaCampo.findFirst({
        where: {
          id: visitaId,
          usuarioId: u.id,
          salida: null,
          local: { cliente: { empresaId: u.empresaId } },
        },
        select: { id: true, localId: true, fecha: true },
      });
      if (!v) throw new NotFoundException('Visita abierta no disponible');
      const tarea = await tx.tareaCampo.findFirst({
        where: {
          id: tareaId,
          empresaId: u.empresaId,
          activo: true,
          fechaDesde: { lte: v.fecha },
          AND: [
            { OR: [{ fechaHasta: null }, { fechaHasta: { gte: v.fecha } }] },
            {
              OR: [
                { todosLocales: true },
                { locales: { some: { localId: v.localId } } },
              ],
            },
          ],
        },
        select: {
          id: true,
          nombre: true,
          requiereFotos: true,
          fotosObligatorias: true,
        },
      });
      if (!tarea) throw new NotFoundException('Tarea no disponible');

      // Validar fotos obligatorias
      if (tarea.requiereFotos && tarea.fotosObligatorias) {
        const fotos = await tx.fotoTareaCampo.findMany({
          where: {
            cumplimientoVisitaId: visitaId,
            cumplimientoTareaId: tareaId,
          },
          select: { momento: true },
          take: 2,
        });

        const tieneAntes = fotos.some((f) => f.momento === 'ANTES');
        const tieneDespues = fotos.some((f) => f.momento === 'DESPUES');

        if (!tieneAntes || !tieneDespues) {
          throw new BadRequestException(
            'Debes subir foto antes y después para completar esta tarea',
          );
        }
      }

      // Determinar si las fotos están validadas
      const fotosValidadas =
        !tarea.requiereFotos ||
        !tarea.fotosObligatorias ||
        (await tx.fotoTareaCampo.count({
          where: {
            cumplimientoVisitaId: visitaId,
            cumplimientoTareaId: tareaId,
          },
        })) >= 2;

      await tx.cumplimientoCampo.upsert({
        where: { visitaId_tareaId: { visitaId, tareaId } },
        create: {
          visitaId,
          tareaId,
          nombreTarea: tarea.nombre,
          fotosValidadas,
        },
        update: { fotosValidadas, completadaAt: new Date() },
        select: { tareaId: true },
      });
      return { ok: true };
    });
  }
  async visitas(usuarioId: number, query: ConsultaCampoDto, equipo = false) {
    const u = equipo
      ? await this.acceso.gestionar(usuarioId, 'visitas')
      : await this.acceso.ejecutar(usuarioId);
    const fecha = fechaCampo(query.fecha ?? relojCampo().fecha);
    const where: Prisma.VisitaCampoWhereInput = {
      fecha,
      localId: query.localId,
      local: { cliente: { empresaId: u.empresaId } },
      ...(equipo
        ? {
            usuario: { empresaId: u.empresaId, superiorId: u.id },
            usuarioId: query.usuarioId,
          }
        : { usuarioId: u.id }),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.visitaCampo.count({ where }),
      this.prisma.visitaCampo.findMany({
        where,
        select: VISITA_CAMPO_SELECT,
        orderBy: { entrada: 'desc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
}
