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
import { ConsultaCampoDto, TareaCampoDto } from './dto/campo.dto';
import { TAREA_CAMPO_SELECT } from './utils/selectores';
import {
  aClientePdv,
  aLocalCampo,
  CLIENTE_OCRD_SELECT,
  conLocalesTarea,
  direccionesLocales,
  LOCAL_OCRD_SELECT,
  filtroLocales,
  nombreLocal,
  rucOcrd,
  telefonoOcrd,
  ubicacionOcrd,
} from './utils/local-ocrd';
import { fechaCampo, relojCampo, vigenciaCampo } from './utils/calendario';
import { ConsultaTareasCampoDto } from './dto/consulta-tareas.dto';
import { destinatarioCampo, exigirEquipoCampo } from './utils/equipo-campo';
import {
  exigirAdministracionTareas,
  permisosCatalogoTareas,
} from './utils/permisos-tareas';
import { detalleTarea } from './utils/version-tarea';
import { filtroPersonalEquipoOperativo } from './utils/personal-equipo';
import { restringirItinerarioAlEquipo } from './utils/alcance-itinerario';
import { obtenerColaboradoresGestionados } from './utils/autorizacion';
import type { UsuarioConAcceso } from '../plataforma/interfaces/usuario-con-acceso.interface';
import { CrearLocalCampoDto, EditarLocalCampoDto } from './dto/crear-local.dto';
import { relanzarDuplicado } from '../common/utils/error-prisma';

@Injectable()
export class CatalogoCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  private async alcanceItinerario(u: UsuarioConAcceso, hoy: Date) {
    const restringido = restringirItinerarioAlEquipo(u);
    const personal = {
      ...filtroPersonalEquipoOperativo(u),
      ...(restringido
        ? { id: { in: await obtenerColaboradoresGestionados(this.prisma, u) } }
        : {}),
    };
    const asignacion = {
      activo: true,
      usuario: personal,
      fechaDesde: { lte: hoy },
      OR: [{ fechaHasta: null }, { fechaHasta: { gte: hoy } }],
    };
    return {
      asignacion,
      locales: restringido ? { asignaciones: { some: asignacion } } : {},
    };
  }

  async locales(usuarioId: number, query: ConsultaCampoDto) {
    // Selector compartido con el ABM de tareas; devuelve solo datos de su empresa.
    const u = await this.acceso
      .gestionar(usuarioId, 'locales')
      .catch((error: unknown) => {
        if (!(error instanceof ForbiddenException)) throw error;
        return this.acceso.gestionar(usuarioId, 'tareas');
      });
    const { skip, take, page, limit } = rangoPaginacion(query);
    const hoy = fechaCampo(relojCampo().fecha);
    const alcance = await this.alcanceItinerario(u, hoy);
    const where = {
      ...filtroLocales(u.empresaId, query.buscar),
      ...alcance.locales,
    };
    const [total, filas] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: {
          ...CLIENTE_OCRD_SELECT,
          asignaciones: {
            where: alcance.asignacion,
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
        ...aClientePdv(l, direcciones.get(l.CardCode)),
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
    const hoy = fechaCampo(relojCampo().fecha);
    const alcance = await this.alcanceItinerario(u, hoy);
    const where: Prisma.SocioNegocioWhereInput = {
      ...filtroLocales(u.empresaId, query.buscar),
      ...alcance.locales,
      AND: [
        { U_Latitud: { not: null } },
        { U_Latitud: { not: '' } },
        { U_Longitud: { not: null } },
        { U_Longitud: { not: '' } },
      ],
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, filas] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: {
          ...LOCAL_OCRD_SELECT,
          asignaciones: {
            where: alcance.asignacion,
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
        ...aLocalCampo(l, direcciones.get(l.CardCode)?.direccion),
        asignaciones,
      })),
      total,
      page,
      limit,
    );
  }
  async crearLocal(usuarioId: number, dto: CrearLocalCampoDto) {
    // El permiso se resuelve por módulo/página, también para roles Back Office.
    // La empresa sale de la sesión: nunca se acepta desde el formulario.
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const ubicacion = ubicacionOcrd(dto);
    const datosCliente = {
      LicTradNum: rucOcrd(dto.LicTradNum),
      Phone1: telefonoOcrd(dto.Phone1),
    };
    const direccion = { address: dto.Address ?? '', street: dto.Street ?? '' };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const local = await tx.socioNegocio.create({
          data: {
            empresaId: u.empresaId,
            CardCode: dto.CardCode,
            CardName: dto.CardName,
            ...datosCliente,
            ...ubicacion,
          },
          select: CLIENTE_OCRD_SELECT,
        });
        if (direccion.address || direccion.street) {
          await tx.socioNegocioDireccion.create({
            data: {
              empresaId: u.empresaId,
              CardCode: dto.CardCode,
              Address: direccion.address || null,
              Street: direccion.street || null,
              AdresType: 'S',
            },
            select: { CardCode: true },
          });
        }
        return aClientePdv(local, direccion);
      });
    } catch (error: unknown) {
      relanzarDuplicado(
        error,
        'Ya existe un cliente con ese código en tu empresa',
      );
    }
  }

  /**
   * Edita el cliente en OCRD y su dirección principal en CRD1 (la de entrega,
   * o la primera). Sin punto en el mapa conserva la ubicación actual.
   */
  async editarLocal(usuarioId: number, id: string, dto: EditarLocalCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const ubicacion = ubicacionOcrd(dto);
    const datosCliente = {
      LicTradNum: rucOcrd(dto.LicTradNum),
      Phone1: telefonoOcrd(dto.Phone1),
    };
    const direccion = { address: dto.Address ?? '', street: dto.Street ?? '' };
    const delCliente = { empresaId: u.empresaId, CardCode: id };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.socioNegocio.updateMany({
          where: delCliente,
          data: { CardName: dto.CardName, ...datosCliente, ...ubicacion },
        });
        if (!count) throw new NotFoundException('Cliente no disponible');
        const actual =
          (await tx.socioNegocioDireccion.findFirst({
            where: { ...delCliente, AdresType: 'S' },
            orderBy: { id: 'asc' },
            select: { id: true },
          })) ??
          (await tx.socioNegocioDireccion.findFirst({
            where: delCliente,
            orderBy: { id: 'asc' },
            select: { id: true },
          }));
        const datos = {
          Address: direccion.address || null,
          Street: direccion.street || null,
        };
        if (actual)
          await tx.socioNegocioDireccion.update({
            where: { id: actual.id },
            data: datos,
            select: { id: true },
          });
        else if (datos.Address || datos.Street)
          await tx.socioNegocioDireccion.create({
            data: { ...delCliente, ...datos, AdresType: 'S' },
            select: { id: true },
          });
        return aClientePdv(
          await tx.socioNegocio.findFirstOrThrow({
            where: delCliente,
            select: CLIENTE_OCRD_SELECT,
          }),
          direccion,
        );
      });
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Esa dirección ya está cargada en el cliente');
    }
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
