import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  ConsultaCampoDto,
  TareaCampoDto,
  UbicacionLocalCampoDto,
} from './dto/campo.dto';
import { TAREA_CAMPO_SELECT } from './utils/selectores';
import {
  aLocalCampo,
  conLocalesTarea,
  direccionesLocales,
  LOCAL_OCRD_SELECT,
  filtroLocales,
  nombreLocal,
  textoCoordenada,
} from './utils/local-ocrd';
import { fechaCampo, relojCampo, vigenciaCampo } from './utils/calendario';
import { ConsultaTareasCampoDto } from './dto/consulta-tareas.dto';
import {
  destinatarioCampo,
  rolDelEquipoCampo,
  exigirEquipoCampo,
} from './utils/equipo-campo';
import {
  exigirAdministracionTareas,
  permisosCatalogoTareas,
} from './utils/permisos-tareas';
import { detalleTarea } from './utils/version-tarea';
import { obtenerColaboradoresGestionados } from './utils/autorizacion';

@Injectable()
export class CatalogoCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async locales(usuarioId: number, query: ConsultaCampoDto) {
    // Selector compartido con el ABM de tareas; devuelve solo datos de su empresa.
    const u = await this.acceso
      .gestionar(usuarioId, 'locales')
      .catch((error: unknown) => {
        if (!(error instanceof ForbiddenException)) throw error;
        return this.acceso.gestionar(usuarioId, 'tareas');
      });
    const where = filtroLocales(u.empresaId, query.buscar);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const hoy = fechaCampo(relojCampo().fecha);
    const colaboradores = await obtenerColaboradoresGestionados(this.prisma, u);
    const [total, filas] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: {
          ...LOCAL_OCRD_SELECT,
          asignaciones: {
            where: {
              activo: true,
              usuario: {
                id: { in: colaboradores },
                rol: rolDelEquipoCampo(u.equipoCampo),
              },
              fechaDesde: { lte: hoy },
              OR: [{ fechaHasta: null }, { fechaHasta: { gte: hoy } }],
            },
            select: {
              id: true,
              usuario: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  rol: { select: { descripcion: true } },
                },
              },
            },
            orderBy: { fechaDesde: 'desc' },
            take: 5,
          },
        },
        orderBy: [{ CardName: 'asc' }, { CardCode: 'asc' }],
        skip,
        take,
      }),
    ]);
    const direcciones = await direccionesLocales(
      this.prisma,
      u.empresaId,
      filas.map((l) => l.CardCode),
    );
    return respuestaPaginada(
      filas.map(({ asignaciones, ...l }) => ({
        ...aLocalCampo(l, direcciones.get(l.CardCode)),
        asignaciones,
      })),
      total,
      page,
      limit,
    );
  }
  /**
   * Puntos del mapa de cobertura: solo socios con U_Latitud/U_Longitud cargadas.
   * Filtra por búsqueda en el servidor para no bajar toda la red.
   */
  async localesMapa(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const where: Prisma.SocioNegocioWhereInput = {
      ...filtroLocales(u.empresaId, query.buscar),
      AND: [
        { U_Latitud: { not: null } },
        { U_Latitud: { not: '' } },
        { U_Longitud: { not: null } },
        { U_Longitud: { not: '' } },
      ],
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const hoy = fechaCampo(relojCampo().fecha);
    const colaboradores = await obtenerColaboradoresGestionados(this.prisma, u);
    const [total, filas] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: {
          ...LOCAL_OCRD_SELECT,
          asignaciones: {
            where: {
              activo: true,
              usuario: {
                id: { in: colaboradores },
                rol: rolDelEquipoCampo(u.equipoCampo),
              },
              fechaDesde: { lte: hoy },
              OR: [{ fechaHasta: null }, { fechaHasta: { gte: hoy } }],
            },
            select: {
              id: true,
              usuario: { select: { id: true, nombre: true, apellido: true } },
            },
            orderBy: { fechaDesde: 'desc' },
            take: 5,
          },
        },
        orderBy: [{ CardName: 'asc' }, { CardCode: 'asc' }],
        skip,
        take,
      }),
    ]);
    const direcciones = await direccionesLocales(
      this.prisma,
      u.empresaId,
      filas.map((l) => l.CardCode),
    );
    return respuestaPaginada(
      filas.map(({ asignaciones, ...l }) => ({
        ...aLocalCampo(l, direcciones.get(l.CardCode)),
        asignaciones,
      })),
      total,
      page,
      limit,
    );
  }
  /** El alta y la baja de socios viven en OCRD; Comercia solo marca el punto. */
  async ubicarLocal(
    usuarioId: number,
    localId: string,
    dto: UbicacionLocalCampoDto,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const { count } = await this.prisma.socioNegocio.updateMany({
      where: { empresaId: u.empresaId, CardCode: localId },
      data: {
        U_Latitud: textoCoordenada(dto.latitud),
        U_Longitud: textoCoordenada(dto.longitud),
      },
    });
    if (!count) throw new NotFoundException('Local no disponible');
    return aLocalCampo(
      await this.prisma.socioNegocio.findFirstOrThrow({
        where: { empresaId: u.empresaId, CardCode: localId },
        select: LOCAL_OCRD_SELECT,
      }),
    );
  }
  async tareas(usuarioId: number, query: ConsultaTareasCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    exigirAdministracionTareas(u.permisosTareas, 'CONSULTAR');
    const alcance = {
      empresaId: u.empresaId,
      equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
      destinatario: destinatarioCampo(u.equipoCampo),
    };
    const where = {
      ...alcance,
      ...(query.archivo === 'todas'
        ? {}
        : {
            archivadaEn: query.archivo === 'archivadas' ? { not: null } : null,
          }),
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.tipo === 'obligatorias' ? { esObligatoria: true } : {}),
      ...(query.tipo === 'con_fotos' ? { requiereFotos: true } : {}),
      ...(query.buscar
        ? {
            OR: [
              {
                nombre: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                descripcion: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items, totalCatalogo, obligatorias, conFotos] =
      await Promise.all([
        this.prisma.tareaCampo.count({ where }),
        this.prisma.tareaCampo.findMany({
          where,
          select: TAREA_CAMPO_SELECT,
          orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
          skip,
          take,
        }),
        this.prisma.tareaCampo.count({ where: alcance }),
        this.prisma.tareaCampo.count({
          where: { ...alcance, esObligatoria: true },
        }),
        this.prisma.tareaCampo.count({
          where: { ...alcance, requiereFotos: true },
        }),
      ]);
    return {
      ...respuestaPaginada(items.map(conLocalesTarea), total, page, limit),
      resumen: { total: totalCatalogo, obligatorias, conFotos },
      permisos: permisosCatalogoTareas(u.permisosTareas),
    };
  }
  async guardarTarea(usuarioId: number, dto: TareaCampoDto, id?: number) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    exigirAdministracionTareas(u.permisosTareas, id ? 'EDITAR' : 'CREAR');
    const destinatario = destinatarioCampo(u.equipoCampo);
    const equipoCampoId = exigirEquipoCampo(u.equipoCampo).id;
    if (dto.destinatario && dto.destinatario !== destinatario)
      throw new BadRequestException(
        'Solo podés crear tareas para tu tipo de equipo',
      );
    if (dto.todosLocales && dto.localIds.length)
      throw new BadRequestException(
        'Elegí todos los locales o una selección específica',
      );
    if (!dto.todosLocales && !dto.localIds.length)
      throw new BadRequestException('Elegí al menos un local');
    const fechas = vigenciaCampo(dto.fechaDesde, dto.fechaHasta);
    const cantidad = await this.prisma.socioNegocio.count({
      where: { CardCode: { in: dto.localIds }, empresaId: u.empresaId },
    });
    if (cantidad !== dto.localIds.length)
      throw new BadRequestException('Selección de locales no disponible');
    if (
      id &&
      !(await this.prisma.tareaCampo.findFirst({
        where: { id, empresaId: u.empresaId, destinatario, equipoCampoId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Tarea no disponible');
    const data = {
      nombre: dto.nombre,
      destinatario,
      equipoCampoId,
      descripcion: dto.descripcion,
      activo: dto.activo,
      todosLocales: dto.todosLocales,
      requiereFotos: dto.requiereFotos,
      fotosObligatorias: dto.fotosObligatorias,
      categoria: dto.categoria ?? 'Góndola',
      esObligatoria: dto.esObligatoria ?? false,
      ...(dto.estado ? { estado: dto.estado } : {}),
      ...fechas,
    };
    // Las tareas globales se resuelven al consultar: incluyen también locales futuros.
    return this.prisma.$transaction(async (tx) => {
      if (id) {
        await tx.$queryRaw`SELECT id FROM campo_tareas WHERE id = ${id} FOR UPDATE`;
        const actual = await tx.tareaCampo.findFirst({
          where: { id, empresaId: u.empresaId, equipoCampoId },
          select: { archivadaEn: true, version: true },
        });
        if (!actual) throw new NotFoundException('Tarea no disponible');
        if (actual.archivadaEn)
          throw new BadRequestException(
            'Las tareas archivadas conservan su historial y no se editan',
          );
        if (
          dto.versionEsperada !== undefined &&
          actual.version !== dto.versionEsperada
        )
          throw new ConflictException(
            'La tarea cambió. Actualizá el catálogo y volvé a abrirla antes de guardar',
          );
      }
      if (id) await tx.tareaLocalCampo.deleteMany({ where: { tareaId: id } });
      const locales = {
        create: dto.localIds.map((localId) => ({
          localId,
          empresaId: u.empresaId,
        })),
      };
      const tarea = id
        ? tx.tareaCampo.update({
            where: { id },
            data: { ...data, locales, version: { increment: 1 } },
            select: TAREA_CAMPO_SELECT,
          })
        : tx.tareaCampo.create({
            data: { ...data, empresaId: u.empresaId, locales },
            select: TAREA_CAMPO_SELECT,
          });
      const guardada = await tarea;
      await tx.versionTareaCampo.create({
        data: {
          tareaId: guardada.id,
          version: guardada.version,
          autorId: usuarioId,
          contenido: detalleTarea({ ...guardada, localIds: dto.localIds }),
        },
      });
      return conLocalesTarea(guardada);
    });
  }
  async eliminarTarea(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    exigirAdministracionTareas(u.permisosTareas, 'ARCHIVAR');
    const tarea = await this.prisma.tareaCampo.findFirst({
      where: {
        id,
        empresaId: u.empresaId,
        equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        destinatario: destinatarioCampo(u.equipoCampo),
      },
      select: { id: true },
    });
    if (!tarea) throw new NotFoundException('Tarea no disponible');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_tareas WHERE id = ${id} FOR UPDATE`;
      const actual = await tx.tareaCampo.findFirst({
        where: {
          id,
          empresaId: u.empresaId,
          equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        },
        select: { archivadaEn: true },
      });
      if (!actual) throw new NotFoundException('Tarea no disponible');
      if (actual.archivadaEn) return;
      const archivada = await tx.tareaCampo.update({
        where: { id },
        data: {
          activo: false,
          archivadaEn: new Date(),
          version: { increment: 1 },
        },
        select: TAREA_CAMPO_SELECT,
      });
      await tx.versionTareaCampo.create({
        data: {
          tareaId: id,
          version: archivada.version,
          autorId: usuarioId,
          contenido: detalleTarea(archivada),
        },
      });
    });
    return { ok: true };
  }

  async versionesTarea(usuarioId: number, id: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    exigirAdministracionTareas(u.permisosTareas, 'CONSULTAR');
    const tarea = await this.prisma.tareaCampo.findFirst({
      where: {
        id,
        empresaId: u.empresaId,
        equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
      },
      select: { id: true },
    });
    if (!tarea) throw new NotFoundException('Tarea no disponible');
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { tareaId: id };
    const [total, items] = await Promise.all([
      this.prisma.versionTareaCampo.count({ where }),
      this.prisma.versionTareaCampo.findMany({
        where,
        skip,
        take,
        orderBy: { version: 'desc' },
        select: { version: true, contenido: true, creadaEn: true },
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async localesTarea(usuarioId: number, id: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    exigirAdministracionTareas(u.permisosTareas, 'CONSULTAR');
    if (
      !(await this.prisma.tareaCampo.findFirst({
        where: {
          id,
          empresaId: u.empresaId,
          equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Tarea no disponible');
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { tareaId: id };
    const [total, filas] = await Promise.all([
      this.prisma.tareaLocalCampo.count({ where }),
      this.prisma.tareaLocalCampo.findMany({
        where,
        skip,
        take,
        orderBy: { localId: 'asc' },
        select: {
          localId: true,
          local: { select: { CardCode: true, CardName: true } },
        },
      }),
    ]);
    return respuestaPaginada(
      filas.map((x) => ({ id: x.localId, nombre: nombreLocal(x.local) })),
      total,
      page,
      limit,
    );
  }
}
