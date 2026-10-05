import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  ClienteCampoDto,
  ConsultaCampoDto,
  LocalCampoDto,
  TareaCampoDto,
} from './dto/campo.dto';
import {
  CLIENTE_CAMPO_SELECT,
  LOCAL_CAMPO_SELECT,
  TAREA_CAMPO_SELECT,
} from './utils/selectores';
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

@Injectable()
export class CatalogoCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async clientes(usuarioId: number, query: ConsultaCampoDto) {
    const usuario = await this.acceso
      .gestionar(usuarioId, 'clientes')
      .catch((error: unknown) => {
        if (!(error instanceof ForbiddenException)) throw error;
        return this.acceso.gestionar(usuarioId, 'locales');
      });
    const where = {
      empresaId: usuario.empresaId,
      ...(query.buscar
        ? {
            OR: [
              {
                nombre: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              { ruc: { contains: query.buscar, mode: 'insensitive' as const } },
              {
                contacto: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.clienteCampo.count({ where }),
      this.prisma.clienteCampo.findMany({
        where,
        select: CLIENTE_CAMPO_SELECT,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarCliente(usuarioId: number, dto: ClienteCampoDto, id?: number) {
    const u = await this.acceso.gestionar(usuarioId, 'clientes');
    if (
      id &&
      !(await this.prisma.clienteCampo.findFirst({
        where: { id, empresaId: u.empresaId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Cliente no disponible');
    return id
      ? this.prisma.clienteCampo.update({
          where: { id },
          data: dto,
          select: CLIENTE_CAMPO_SELECT,
        })
      : this.prisma.clienteCampo.create({
          data: { ...dto, empresaId: u.empresaId },
          select: CLIENTE_CAMPO_SELECT,
        });
  }
  async eliminarCliente(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'clientes');
    const resultado = await this.prisma.clienteCampo.updateMany({
      where: { id, empresaId: u.empresaId },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('Cliente no disponible');
    return { ok: true };
  }
  async locales(usuarioId: number, query: ConsultaCampoDto) {
    // Selector compartido con el ABM de tareas; devuelve solo datos de su empresa.
    const u = await this.acceso
      .gestionar(usuarioId, 'locales')
      .catch((error: unknown) => {
        if (!(error instanceof ForbiddenException)) throw error;
        return this.acceso.gestionar(usuarioId, 'tareas');
      });
    const where = {
      cliente: { empresaId: u.empresaId },
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
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
                direccion: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
              {
                contacto: {
                  contains: query.buscar,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const hoy = fechaCampo(relojCampo().fecha);
    const [total, items] = await Promise.all([
      this.prisma.localCampo.count({ where }),
      this.prisma.localCampo.findMany({
        where,
        select: {
          ...LOCAL_CAMPO_SELECT,
          asignaciones: {
            where: {
              activo: true,
              usuario: {
                superiorId: u.id,
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
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarLocal(usuarioId: number, dto: LocalCampoDto, id?: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const cliente = await this.prisma.clienteCampo.findFirst({
      where: { id: dto.clienteId, empresaId: u.empresaId, activo: true },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no disponible');
    if (id) await this.acceso.local(u.empresaId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM empresas WHERE id = ${u.empresaId} FOR UPDATE`;
      const direccion = dto.direccion.trim();
      const repetido = await tx.localCampo.findFirst({
        where: {
          activo: true,
          cliente: { empresaId: u.empresaId },
          ...(id ? { id: { not: id } } : {}),
          nombre: { equals: dto.nombre.trim(), mode: 'insensitive' },
          OR: [
            ...(direccion
              ? [
                  {
                    direccion: {
                      equals: direccion,
                      mode: 'insensitive' as const,
                    },
                  },
                ]
              : []),
            { latitud: dto.latitud, longitud: dto.longitud },
          ],
        },
        select: { id: true },
      });
      if (repetido)
        throw new BadRequestException(
          `El local ya existe (#${repetido.id}); asignalo desde el catálogo`,
        );
      return id
        ? tx.localCampo.update({
            where: { id },
            data: dto,
            select: LOCAL_CAMPO_SELECT,
          })
        : tx.localCampo.create({ data: dto, select: LOCAL_CAMPO_SELECT });
    });
  }
  async eliminarLocal(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, id);
    await this.prisma.localCampo.update({
      where: { id },
      data: { activo: false },
      select: { id: true },
    });
    return { ok: true };
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
      ...respuestaPaginada(items, total, page, limit),
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
    const cantidad = await this.prisma.localCampo.count({
      where: { id: { in: dto.localIds }, cliente: { empresaId: u.empresaId } },
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
      const locales = { create: dto.localIds.map((localId) => ({ localId })) };
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
      return guardada;
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
        select: { localId: true, local: { select: { nombre: true } } },
      }),
    ]);
    return respuestaPaginada(
      filas.map((x) => ({ id: x.localId, nombre: x.local.nombre })),
      total,
      page,
      limit,
    );
  }
}
