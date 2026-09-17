import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { vigenciaCampo } from './utils/calendario';
import { ConsultaTareasCampoDto } from './dto/consulta-tareas.dto';

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
              { nombre: { contains: query.buscar, mode: 'insensitive' as const } },
              { ruc: { contains: query.buscar, mode: 'insensitive' as const } },
              { contacto: { contains: query.buscar, mode: 'insensitive' as const } },
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
              { nombre: { contains: query.buscar, mode: 'insensitive' as const } },
              { direccion: { contains: query.buscar, mode: 'insensitive' as const } },
              { contacto: { contains: query.buscar, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.localCampo.count({ where }),
      this.prisma.localCampo.findMany({
        where,
        select: LOCAL_CAMPO_SELECT,
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
    return id
      ? this.prisma.localCampo.update({
          where: { id },
          data: dto,
          select: LOCAL_CAMPO_SELECT,
        })
      : this.prisma.localCampo.create({
          data: dto,
          select: LOCAL_CAMPO_SELECT,
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
    const where = {
      empresaId: u.empresaId,
      ...(query.categoria ? { categoria: query.categoria } : {}),
      ...(query.tipo === 'obligatorias' ? { esObligatoria: true } : {}),
      ...(query.tipo === 'con_fotos' ? { requiereFotos: true } : {}),
      ...(query.buscar
        ? { OR: [
            { nombre: { contains: query.buscar, mode: 'insensitive' as const } },
            { descripcion: { contains: query.buscar, mode: 'insensitive' as const } },
          ] }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items, totalCatalogo, obligatorias, conFotos] = await Promise.all([
      this.prisma.tareaCampo.count({ where }),
      this.prisma.tareaCampo.findMany({
        where,
        select: TAREA_CAMPO_SELECT,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.tareaCampo.count({ where: { empresaId: u.empresaId } }),
      this.prisma.tareaCampo.count({ where: { empresaId: u.empresaId, esObligatoria: true } }),
      this.prisma.tareaCampo.count({ where: { empresaId: u.empresaId, requiereFotos: true } }),
    ]);
    return { ...respuestaPaginada(items, total, page, limit), resumen: { total: totalCatalogo, obligatorias, conFotos } };
  }
  async guardarTarea(usuarioId: number, dto: TareaCampoDto, id?: number) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
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
        where: { id, empresaId: u.empresaId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Tarea no disponible');
    const data = {
      nombre: dto.nombre,
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
      if (id) await tx.tareaLocalCampo.deleteMany({ where: { tareaId: id } });
      const locales = { create: dto.localIds.map((localId) => ({ localId })) };
      return id
        ? tx.tareaCampo.update({
            where: { id },
            data: { ...data, locales },
            select: TAREA_CAMPO_SELECT,
          })
        : tx.tareaCampo.create({
            data: { ...data, empresaId: u.empresaId, locales },
            select: TAREA_CAMPO_SELECT,
          });
    });
  }
  async eliminarTarea(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'tareas');
    const resultado = await this.prisma.tareaCampo.updateMany({
      where: { id, empresaId: u.empresaId },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('Tarea no disponible');
    return { ok: true };
  }
}
