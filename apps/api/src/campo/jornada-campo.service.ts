import {
  aLocalCampo,
  conLocalCampo,
  direccionesLocales,
  LOCAL_OCRD_SELECT,
} from './utils/local-ocrd';
import {
  evaluarMarcaHorario,
  heredarTolerancias,
} from '../tolerancias/utils/tolerancia-horario';
import {
  BadRequestException,
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
import {
  aTareaJornada,
  camposTareaJornada,
  CUMPLIMIENTO_JORNADA_SELECT,
  TAREA_JORNADA_SELECT,
} from './utils/tarea-jornada';
import { ConsultaTareasDiaDto } from './dto/consulta-tareas-dia.dto';
import { prepararEvidencia, tareaParaEvidencia } from './utils/evidencia-tarea';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import { ConsultaCampoDto, MarcaCampoDto } from './dto/campo.dto';
import {
  fechaCampo,
  ocurreHorarioEnRango,
  rangoConsulta,
  relojCampo,
  ZONA_CAMPO,
} from './utils/calendario';
import { condicionAgenda } from './utils/agenda-sql';
import { obtenerColaboradoresGestionados } from './utils/autorizacion';
import { comprobarMarcaEnLocal } from './utils/marcacion';
import {
  conEstadoVisita,
  estadoAgenda,
  estadoVisita,
} from './utils/estado-jornada';
import { HORARIO_CAMPO_SELECT, VISITA_CAMPO_SELECT } from './utils/selectores';
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
        empresaId,
      },
      select: {
        id: true,
        localId: true,
        local: { select: LOCAL_OCRD_SELECT },
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
    const base = Prisma.sql`FROM campo_asignaciones a JOIN tbl_ocrd l ON l.empresa_id = a.empresa_id AND l."CardCode" = a."CardCode" WHERE ${condicion}`;
    const [conteo, ids] = await Promise.all([
      this.prisma.$queryRaw<TotalAgenda[]>(
        Prisma.sql`SELECT COUNT(DISTINCT l."CardCode") AS total ${base}`,
      ),
      this.prisma.$queryRaw<FilaAgendaId[]>(
        Prisma.sql`SELECT elegida.id FROM (
          SELECT DISTINCT ON (l."CardCode") a.id, l."CardCode" AS local_id,
            COALESCE(NULLIF(TRIM(l."CardName"), ''), l."CardCode") AS nombre
          ${base}
          ORDER BY l."CardCode", CASE WHEN a.usuario_id = ${u.id} THEN 0 ELSE 1 END, a.id
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
            ...LOCAL_OCRD_SELECT,
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
    const direcciones = await direccionesLocales(
      this.prisma,
      u.empresaId,
      filas.map((f) => f.local.CardCode),
    );
    const ahora = new Date();
    const items = ids.flatMap(({ id }) => {
      const a = porId.get(id);
      return a
        ? [
            {
              id: a.id,
              esPrincipal: a.local.CardCode === preferencia?.localPrincipalId,
              esBackup: a.usuarioId !== u.id && !esTeamleader,
              heredada: a.usuarioId !== u.id && esTeamleader,
              titular: `${a.usuario.nombre} ${a.usuario.apellido}`,
              local: {
                ...aLocalCampo(
                  a.local,
                  direcciones.get(a.local.CardCode)?.direccion,
                ),
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
                ZONA_CAMPO,
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
  async abierta(usuarioId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    // Una jornada anterior queda incompleta; nunca se inventa una salida.
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        usuarioId: u.id,
        fecha: fechaCampo(relojCampo().fecha),
        salida: null,
        empresaId: u.empresaId,
      },
      select: VISITA_CAMPO_SELECT,
    });
    return visita ? conLocalCampo(conEstadoVisita(visita)) : null;
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
        empresaId: u.empresaId,
      },
      select: {
        toleranciasAplicadas: true,
        horario: { select: { entrada: true, salida: true } },
        local: { select: LOCAL_OCRD_SELECT },
      },
    });
    if (!visita) throw new NotFoundException('Visita abierta no disponible');
    const distancia = comprobarMarcaEnLocal(
      dto,
      aLocalCampo(visita.local),
      ahora,
    );
    const evaluacion =
      visita.horario && visita.toleranciasAplicadas
        ? evaluarMarcaHorario(
            'SALIDA',
            ahora,
            relojCampo(ahora).fecha,
            visita.horario.entrada,
            visita.horario.salida,
            ZONA_CAMPO,
            heredarTolerancias(visita.toleranciasAplicadas),
          )
        : null;
    const resultado = await this.prisma.visitaCampo.updateMany({
      where: {
        id,
        usuarioId: u.id,
        fecha,
        salida: null,
        empresaId: u.empresaId,
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
        empresaId: u.empresaId,
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
          ...TAREA_JORNADA_SELECT,
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
            select: CUMPLIMIENTO_JORNADA_SELECT,
          },
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      items.map(({ cumplimientos, ...t }) => aTareaJornada(t, cumplimientos)),
      total,
      page,
      limit,
    );
  }
  /**
   * Tareas de varios locales de la ruta en un pedido: valida todas las
   * asignaciones de una vez y trae las tareas de esos locales en una sola
   * consulta. Devuelve, por asignación, la misma página que
   * `jornada/asignaciones/:id/tareas`. Las asignaciones ajenas o fuera de
   * fecha se omiten. La lista exterior está acotada a 50 asignaciones.
   */
  async tareasDelDia(usuarioId: number, query: ConsultaTareasDiaDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const { desde, hasta } = rangoConsulta(query);
    const fechaDesde = fechaCampo(desde);
    const fechaHasta = fechaCampo(hasta);
    const encontradas = await this.prisma.asignacionCampo.findMany({
      where: {
        id: { in: query.asignaciones },
        usuario: { rol: rolDelEquipoCampo(u.equipoCampo) },
        activo: true,
        fechaDesde: { lte: fechaHasta },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
        empresaId: u.empresaId,
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
      take: query.asignaciones.length,
    });
    const asignaciones = encontradas.filter(
      (a) =>
        a.usuarioId === u.id || a.backups.some((b) => b.usuarioId === u.id),
    );
    if (asignaciones.length === 0) return { items: [] };
    const localIds = [...new Set(asignaciones.map((a) => a.localId))];
    const asignacionIds = asignaciones.map((a) => a.id);
    const tareas = await this.prisma.tareaCampo.findMany({
      where: {
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
                  { locales: { some: { localId: { in: localIds } } } },
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
                  asignacionId: { in: asignacionIds },
                  salida: null,
                  fecha: { gte: fechaDesde, lte: fechaHasta },
                },
              },
            },
          },
        ],
      },
      select: {
        ...TAREA_JORNADA_SELECT,
        activo: true,
        fechaDesde: true,
        fechaHasta: true,
        todosLocales: true,
        locales: {
          where: { localId: { in: localIds } },
          select: { localId: true },
        },
        cumplimientos: {
          where: {
            visita: {
              usuarioId,
              asignacionId: { in: asignacionIds },
              fecha: { gte: fechaDesde, lte: fechaHasta },
            },
          },
          take: 21 * asignacionIds.length,
          select: {
            ...CUMPLIMIENTO_JORNADA_SELECT,
            visita: {
              select: {
                asignacionId: true,
                fecha: true,
                entrada: true,
                salida: true,
              },
            },
          },
        },
      },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    const { skip, take, page, limit } = rangoPaginacion(query);
    return {
      items: asignaciones.map((a) => {
        // Mismas reglas que tareas(): vigente para su local, o con una
        // ejecución abierta en esta asignación.
        const delLocal = tareas.filter(
          (t) =>
            (t.activo &&
              t.fechaDesde <= fechaHasta &&
              (t.fechaHasta === null || t.fechaHasta >= fechaDesde) &&
              (t.todosLocales ||
                t.locales.some((l) => l.localId === a.localId))) ||
            t.cumplimientos.some(
              (c) =>
                c.completadaAt === null &&
                c.visita.salida === null &&
                c.visita.asignacionId === a.id,
            ),
        );
        const pagina = delLocal
          .slice(skip, skip + take)
          .map((t) =>
            aTareaJornada(
              camposTareaJornada(t),
              t.cumplimientos
                .filter((c) => c.visita.asignacionId === a.id)
                .slice(0, 21),
            ),
          );
        return {
          asignacionId: a.id,
          ...respuestaPaginada(pagina, delLocal.length, page, limit),
        };
      }),
    };
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
          empresaId: u.empresaId,
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
      empresaId: u.empresaId,
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
      items.map((v) => conLocalCampo(conEstadoVisita(v))),
      total,
      page,
      limit,
    );
  }
}
