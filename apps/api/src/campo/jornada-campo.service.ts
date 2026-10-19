import { localesOperativos } from './utils/locales-operativos';
import { cargarTolerancias } from '../tolerancias/utils/cargar-tolerancias';
import {
  evaluarMarcaHorario,
  heredarTolerancias,
} from '../tolerancias/utils/tolerancia-horario';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  destinatarioCampo,
  rolDelEquipoCampo,
  exigirEquipoCampo,
} from './utils/equipo-campo';
import { datosTareaRegistrada, detalleTarea } from './utils/version-tarea';
import { prepararEvidencia, tareaParaEvidencia } from './utils/evidencia-tarea';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  ConsultaCampoDto,
  EntradaCampoDto,
  MarcaCampoDto,
} from './dto/campo.dto';
import {
  fechaCampo,
  ocurreHorario,
  ocurreHorarioEnRango,
  rangoConsulta,
  relojCampo,
} from './utils/calendario';
import { condicionAgenda } from './utils/agenda-sql';
import { obtenerColaboradoresGestionados } from './utils/autorizacion';
import { comprobarMarcaEnLocal } from './utils/marcacion';
import {
  conEstadoVisita,
  estadoAgenda,
  estadoVisita,
} from './utils/estado-jornada';
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
    esTeamleader: boolean,
    equipoCampo?:
      | import('../roles/interfaces/equipo-campo.interface').EquipoCampoDto
      | null,
  ) {
    const a = await tx.asignacionCampo.findFirst({
      where: {
        id,
        usuario: { rol: rolDelEquipoCampo(equipoCampo) },
        activo: true,
        fechaDesde: { lte: fecha },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
        local: { activo: true, ...localesOperativos(empresaId) },
      },
      select: {
        id: true,
        localId: true,
        local: {
          select: {
            latitud: true,
            longitud: true,
            radioMetros: true,
            zonaHoraria: true,
          },
        },
        usuarioId: true,
        usuario: {
          select: {
            superiorId: true,
            isActive: true,
            rol: { select: { equipoCampoId: true } },
          },
        },
        backups: {
          where: {
            activo: true,
            fechaDesde: { lte: fecha },
            fechaHasta: { gte: fecha },
          },
          take: 1,
          select: {
            usuarioId: true,
            usuario: {
              select: {
                superiorId: true,
                isActive: true,
                rol: { select: { equipoCampoId: true } },
              },
            },
          },
        },
      },
    });
    const responsable = a?.backups[0] ? a.backups[0].usuario : a?.usuario;
    if (
      !a ||
      ((a.backups[0]?.usuarioId ?? a.usuarioId) !== usuarioId &&
        !(
          esTeamleader &&
          responsable?.isActive &&
          responsable.superiorId === usuarioId &&
          responsable.rol?.equipoCampoId === exigirEquipoCampo(equipoCampo).id
        ))
    )
      throw new NotFoundException('Asignación no disponible para esta fecha');
    return a;
  }
  async agenda(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const esTeamleader = ['teamleader', 'teamleaderimpulsador'].includes(
      u.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '') ?? '',
    );
    const { desde, hasta } = rangoConsulta(query);
    const fechaDesde = fechaCampo(desde);
    const fechaHasta = fechaCampo(hasta);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const condicion = condicionAgenda(
      u.empresaId,
      u.id,
      desde,
      hasta,
      exigirEquipoCampo(u.equipoCampo).id,
    );
    const preferencia = await this.prisma.usuario.findFirst({
      where: { id: u.id, empresaId: u.empresaId },
      select: { localPrincipalId: true },
    });
    const base = Prisma.sql`FROM campo_asignaciones a JOIN campo_locales l ON l.id = a.local_id LEFT JOIN campo_clientes c ON c.id = l.cliente_id WHERE ${condicion}`;
    const [conteo, ids] = await Promise.all([
      this.prisma.$queryRaw<TotalAgenda[]>(
        Prisma.sql`SELECT COUNT(DISTINCT l.id) AS total ${base}`,
      ),
      this.prisma.$queryRaw<FilaAgendaId[]>(
        Prisma.sql`SELECT elegida.id FROM (
          SELECT DISTINCT ON (l.id) a.id, l.id AS local_id, l.nombre
          ${base}
          ORDER BY l.id, CASE WHEN a.usuario_id = ${u.id} THEN 0 ELSE 1 END, a.id
        ) elegida ORDER BY CASE WHEN elegida.local_id = ${preferencia?.localPrincipalId ?? null} THEN 0 ELSE 1 END, elegida.nombre, elegida.id LIMIT ${take} OFFSET ${skip}`,
      ),
    ]);
    const filas = await this.prisma.asignacionCampo.findMany({
      where: { id: { in: ids.map((x) => x.id) } },
      take,
      select: {
        id: true,
        usuarioId: true,
        fechaDesde: true,
        fechaHasta: true,
        usuario: { select: { nombre: true, apellido: true } },
        horarios: {
          where: {
            activo: true,
            equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
            destinatario: destinatarioCampo(u.equipoCampo),
          },
          take: 20,
          orderBy: { entrada: 'asc' },
          select: HORARIO_CAMPO_SELECT,
        },
        local: {
          select: {
            ...LOCAL_CAMPO_SELECT,
            horarios: {
              where: {
                activo: true,
                asignacionId: null,
                equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
                destinatario: destinatarioCampo(u.equipoCampo),
              },
              take: 20,
              orderBy: { entrada: 'asc' },
              select: HORARIO_CAMPO_SELECT,
            },
          },
        },
        visitas: {
          where: {
            usuarioId,
            fecha: { gte: fechaDesde, lte: fechaHasta },
          },
          take: 200,
          select: {
            id: true,
            horarioId: true,
            toleranciasAplicadas: true,
            entradaColor: true,
            salidaColor: true,
            fecha: true,
            entrada: true,
            salida: true,
            local: { select: { zonaHoraria: true } },
            horario: { select: { entrada: true, salida: true } },
            eventosUcheck: {
              where: { tipo: 'ENTRADA' },
              take: 1,
              select: { horaDesde: true, horaHasta: true },
            },
          },
        },
      },
    });
    const porId = new Map(filas.map((f) => [f.id, f]));
    const ahora = new Date();
    const items = ids.flatMap(({ id }) => {
      const a = porId.get(id);
      return a
        ? [
            {
              id: a.id,
              esPrincipal: a.local.id === preferencia?.localPrincipalId,
              esBackup: a.usuarioId !== u.id && !esTeamleader,
              heredada: a.usuarioId !== u.id && esTeamleader,
              titular: `${a.usuario.nombre} ${a.usuario.apellido}`,
              local: {
                ...a.local,
                horarios: (a.horarios.length
                  ? a.horarios
                  : a.local.horarios
                ).filter((h) =>
                  ocurreHorarioEnRango(h, fechaDesde, fechaHasta),
                ),
              },
              visitas: a.visitas.map((v) => conEstadoVisita(v, ahora)),
              ...estadoAgenda(
                a.visitas,
                a.horarios.length ? a.horarios : a.local.horarios,
                a.local.zonaHoraria,
                desde,
                hasta,
                ahora,
                a,
              ),
            },
          ]
        : [];
    });
    return respuestaPaginada(items, Number(conteo[0].total), page, limit);
  }
  async entrada(usuarioId: number, dto: EntradaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const esTeamleader = ['teamleader', 'teamleaderimpulsador'].includes(
      u.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '') ?? '',
    );
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
          esTeamleader,
          u.equipoCampo,
        );
        const distancia = comprobarMarcaEnLocal(dto, a.local, ahora);
        if (
          await tx.visitaCampo.count({
            where: { usuarioId, fecha, salida: null },
          })
        )
          throw new ConflictException(
            'Cerrá tu visita abierta antes de marcar otra entrada',
          );
        const horarios = await tx.horarioCampo.findMany({
          where: {
            localId: a.localId,
            equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
            destinatario: destinatarioCampo(u.equipoCampo),
            activo: true,
            OR: [{ asignacionId: a.id }, { asignacionId: null }],
          },
          select: HORARIO_CAMPO_SELECT,
          take: 40,
        });
        const efectivos = horarios.some((h) => h.asignacionId === a.id)
          ? horarios.filter((h) => h.asignacionId === a.id)
          : horarios.filter((h) => h.asignacionId === null);
        const h = efectivos.find((x) => x.id === dto.horarioId);
        if (efectivos.length) {
          if (!h || !ocurreHorario(h, fecha))
            throw new BadRequestException(
              'Seleccioná una franja válida para hoy',
            );
        } else if (dto.horarioId != null)
          throw new BadRequestException('Horario no disponible');
        const tolerancias = await cargarTolerancias(
          tx,
          u.empresaId,
          u.id,
          h?.id,
        );
        const evaluacion = h
          ? evaluarMarcaHorario(
              'ENTRADA',
              ahora,
              reloj.fecha,
              h.entrada,
              h.salida,
              a.local.zonaHoraria,
              tolerancias,
            )
          : null;
        const visita = await tx.visitaCampo.create({
          data: {
            localId: a.localId,
            asignacionId: a.id,
            usuarioId: u.id,
            horarioId: dto.horarioId ?? null,
            fecha,
            entrada: ahora,
            esBackup: a.usuarioId !== u.id && !esTeamleader,
            entradaLat: dto.latitud,
            entradaLng: dto.longitud,
            entradaPrecision: dto.precisionMetros,
            entradaDistancia: distancia,
            toleranciasAplicadas: { ...tolerancias },
            entradaColor: evaluacion?.color,
            entradaFueraHorario: evaluacion
              ? evaluacion.color !== 'VERDE'
              : false,
            notaEntrada: dto.nota,
          },
          select: VISITA_CAMPO_SELECT,
        });
        return conEstadoVisita(visita, ahora);
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
    // Una jornada anterior queda incompleta; nunca se inventa una salida.
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        usuarioId: u.id,
        fecha: fechaCampo(relojCampo().fecha),
        salida: null,
        local: { empresaId: u.empresaId },
      },
      select: VISITA_CAMPO_SELECT,
    });
    return visita ? conEstadoVisita(visita) : null;
  }
  async salida(usuarioId: number, id: number, dto: MarcaCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const ahora = new Date();
    const fecha = fechaCampo(relojCampo(ahora).fecha);
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        id,
        usuarioId: u.id,
        fecha,
        salida: null,
        local: { empresaId: u.empresaId },
      },
      select: {
        toleranciasAplicadas: true,
        horario: { select: { entrada: true, salida: true } },
        local: {
          select: {
            latitud: true,
            longitud: true,
            radioMetros: true,
            zonaHoraria: true,
          },
        },
      },
    });
    if (!visita) throw new NotFoundException('Visita abierta no disponible');
    const distancia = comprobarMarcaEnLocal(dto, visita.local, ahora);
    const evaluacion =
      visita.horario && visita.toleranciasAplicadas
        ? evaluarMarcaHorario(
            'SALIDA',
            ahora,
            relojCampo(ahora).fecha,
            visita.horario.entrada,
            visita.horario.salida,
            visita.local.zonaHoraria,
            heredarTolerancias(visita.toleranciasAplicadas),
          )
        : null;
    const resultado = await this.prisma.visitaCampo.updateMany({
      where: {
        id,
        usuarioId: u.id,
        fecha,
        salida: null,
        local: { empresaId: u.empresaId },
      },
      data: {
        salida: ahora,
        salidaLat: dto.latitud,
        salidaLng: dto.longitud,
        salidaPrecision: dto.precisionMetros,
        salidaDistancia: distancia,
        salidaColor: evaluacion?.color,
        salidaFueraHorario: evaluacion
          ? evaluacion.color !== 'VERDE'
          : undefined,
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
    const { desde, hasta } = rangoConsulta(query);
    const fechaDesde = fechaCampo(desde);
    const fechaHasta = fechaCampo(hasta);
    const a = await this.prisma.asignacionCampo.findFirst({
      where: {
        id: asignacionId,
        usuario: { rol: rolDelEquipoCampo(u.equipoCampo) },
        activo: true,
        fechaDesde: { lte: fechaHasta },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
        local: {
          activo: true,
          ...localesOperativos(u.empresaId),
        },
      },
      select: {
        id: true,
        localId: true,
        usuarioId: true,
        backups: {
          where: {
            activo: true,
            fechaDesde: { lte: fechaHasta },
            fechaHasta: { gte: fechaDesde },
          },
          select: { usuarioId: true },
        },
      },
    });
    if (
      !a ||
      (a.usuarioId !== u.id && !a.backups.some((b) => b.usuarioId === u.id))
    )
      throw new NotFoundException('Asignación no disponible para esta fecha');
    const { skip, take, page, limit } = rangoPaginacion(query);
    // El repositor puede consultar las tareas del local antes de marcar
    // entrada; iniciarlas y completarlas sigue exigiendo su visita abierta
    // (ver iniciarTarea y completar).
    const where: Prisma.TareaCampoWhereInput = {
      empresaId: u.empresaId,
      equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
      destinatario: destinatarioCampo(u.equipoCampo),
      OR: [
        {
          activo: true,
          fechaDesde: { lte: fechaHasta },
          AND: [
            {
              OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
            },
            {
              OR: [
                { todosLocales: true },
                { locales: { some: { localId: a.localId } } },
              ],
            },
          ],
        },
        {
          cumplimientos: {
            some: {
              completadaAt: null,
              visita: {
                usuarioId,
                asignacionId,
                salida: null,
                fecha: { gte: fechaDesde, lte: fechaHasta },
              },
            },
          },
        },
      ],
    };
    const [total, items] = await Promise.all([
      this.prisma.tareaCampo.count({ where }),
      this.prisma.tareaCampo.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          destinatario: true,
          descripcion: true,
          requiereFotos: true,
          fotosObligatorias: true,
          categoria: true,
          esObligatoria: true,
          cumplimientos: {
            // Incluye borradores para que el impulsador pueda ver las
            // evidencias cargadas antes de completar la tarea.
            where: {
              visita: {
                usuarioId,
                asignacionId,
                fecha: { gte: fechaDesde, lte: fechaHasta },
              },
            },
            take: 21,
            select: {
              visitaId: true,
              completadaAt: true,
              iniciadaAt: true,
              detalleTarea: true,
              versionTarea: true,
              visita: { select: { fecha: true, entrada: true, salida: true } },
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
        ...datosTareaRegistrada(
          t,
          cumplimientos.find(
            (c) =>
              c.completadaAt === null && estadoVisita(c.visita) === 'EN_CURSO',
          )?.detalleTarea,
          cumplimientos.find(
            (c) =>
              c.completadaAt === null && estadoVisita(c.visita) === 'EN_CURSO',
          )?.versionTarea,
        ),
        iniciadaAt:
          cumplimientos.find(
            (c) =>
              c.iniciadaAt &&
              c.completadaAt === null &&
              estadoVisita(c.visita) === 'EN_CURSO',
          )?.iniciadaAt ?? null,
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
  async iniciarTarea(usuarioId: number, visitaId: number, tareaId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_visitas WHERE id = ${visitaId} FOR UPDATE`;
      const tarea = await tareaParaEvidencia(
        tx,
        usuarioId,
        u.empresaId,
        visitaId,
        tareaId,
      );
      await prepararEvidencia(
        tx,
        visitaId,
        tareaId,
        tarea.nombre,
        tarea.version,
        detalleTarea(tarea),
      );
      await tx.cumplimientoCampo.updateMany({
        where: { visitaId, tareaId, completadaAt: null, iniciadaAt: null },
        data: { iniciadaAt: new Date(), actividadEn: new Date() },
      });
      return { ok: true };
    });
  }

  async completar(usuarioId: number, visitaId: number, tareaId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_visitas WHERE id = ${visitaId} FOR UPDATE`;
      const v = await tx.visitaCampo.findFirst({
        where: {
          id: visitaId,
          usuarioId: u.id,
          local: { empresaId: u.empresaId },
        },
        select: { id: true, localId: true, fecha: true, salida: true },
      });
      if (!v) throw new NotFoundException('Visita abierta no disponible');
      const previo = await tx.cumplimientoCampo.findUnique({
        where: { visitaId_tareaId: { visitaId, tareaId } },
        select: { completadaAt: true, detalleTarea: true, versionTarea: true },
      });
      if (previo?.completadaAt) return { ok: true };
      if (estadoVisita(v) !== 'EN_CURSO')
        throw new BadRequestException(
          'La visita ya terminó; conservá la acción pendiente para su revisión',
        );
      const actual = await tx.tareaCampo.findFirst({
        where: {
          id: tareaId,
          empresaId: u.empresaId,
          equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
          destinatario: destinatarioCampo(u.equipoCampo),
          ...(previo
            ? {}
            : {
                activo: true,
                fechaDesde: { lte: v.fecha },
                AND: [
                  {
                    OR: [
                      { fechaHasta: null },
                      { fechaHasta: { gte: v.fecha } },
                    ],
                  },
                  {
                    OR: [
                      { todosLocales: true },
                      { locales: { some: { localId: v.localId } } },
                    ],
                  },
                ],
              }),
        },
        select: {
          id: true,
          nombre: true,
          requiereFotos: true,
          fotosObligatorias: true,
          version: true,
          descripcion: true,
          categoria: true,
          esObligatoria: true,
        },
      });
      if (!actual) throw new NotFoundException('Tarea no disponible');
      const tarea = datosTareaRegistrada(
        actual,
        previo?.detalleTarea,
        previo?.versionTarea,
      );

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
          versionTarea: tarea.version,
          detalleTarea: detalleTarea(tarea),
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
    const { desde, hasta } = rangoConsulta(query);
    const where: Prisma.VisitaCampoWhereInput = {
      fecha: { gte: fechaCampo(desde), lte: fechaCampo(hasta) },
      localId: query.localId,
      local: { empresaId: u.empresaId },
      ...(equipo
        ? {
            usuario: { empresaId: u.empresaId },
            AND: [
              {
                usuarioId: {
                  in: await obtenerColaboradoresGestionados(this.prisma, u),
                },
              },
              { usuarioId: query.usuarioId },
            ],
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
    return respuestaPaginada(
      items.map((v) => conEstadoVisita(v)),
      total,
      page,
      limit,
    );
  }
}
