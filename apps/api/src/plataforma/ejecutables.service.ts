import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Ejecutable } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarEjecutableDto,
  CrearEjecutableDto,
} from './dto/ejecutable.dto';
import { ActualizarConexionDto, CrearConexionDto } from './dto/conexion.dto';
import type {
  ConexionDto,
  EjecutableDto,
} from './interfaces/plataforma.interface';
import { relanzarDuplicado } from '../common/utils/error-prisma';

const SELECT_CONEXION = {
  id: true,
  nombre: true,
  servernode: true,
  userDb: true,
  passwordDb: true,
  serviceLayer: true,
  versionTls: true,
  _count: { select: { ejecutables: true } },
} as const;

@Injectable()
export class EjecutablesService {
  constructor(private readonly prisma: PrismaService) {}

  // La password_db se lee solo para saber si está cargada; nunca se devuelve.
  private aConexionDto(c: {
    id: number;
    nombre: string;
    servernode: string | null;
    userDb: string | null;
    passwordDb: string | null;
    serviceLayer: string | null;
    versionTls: string | null;
    _count: { ejecutables: number };
  }): ConexionDto {
    return {
      id: c.id,
      nombre: c.nombre,
      servernode: c.servernode,
      userDb: c.userDb,
      serviceLayer: c.serviceLayer,
      versionTls: c.versionTls,
      tienePassword: !!c.passwordDb,
      ejecutables: c._count.ejecutables,
    };
  }

  // Para el <select> de ejecutables y el ABM de conexiones (son pocas).
  async listarConexiones(): Promise<ConexionDto[]> {
    const filas = await this.prisma.conexion.findMany({
      select: SELECT_CONEXION,
      orderBy: { nombre: 'asc' },
      take: 200,
    });
    return filas.map((c) => this.aConexionDto(c));
  }

  async crearConexion(dto: CrearConexionDto): Promise<ConexionDto> {
    try {
      const c = await this.prisma.conexion.create({
        data: { ...dto, passwordDb: dto.passwordDb || null },
        select: SELECT_CONEXION,
      });
      return this.aConexionDto(c);
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Ya existe una conexión con ese nombre');
    }
  }

  async actualizarConexion(
    id: number,
    dto: ActualizarConexionDto,
  ): Promise<ConexionDto> {
    await this.obtenerConexion(id);
    try {
      const c = await this.prisma.conexion.update({
        where: { id },
        data: { ...dto, passwordDb: dto.passwordDb || undefined },
        select: SELECT_CONEXION,
      });
      return this.aConexionDto(c);
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Ya existe una conexión con ese nombre');
    }
  }

  async eliminarConexion(id: number): Promise<{ ok: true }> {
    const c = await this.obtenerConexion(id);
    if (c._count.ejecutables)
      throw new ConflictException(
        `La usan ${c._count.ejecutables} ejecutables: cambiales la conexión antes de eliminarla`,
      );
    await this.prisma.conexion.delete({ where: { id }, select: { id: true } });
    return { ok: true };
  }

  private async obtenerConexion(id: number) {
    const c = await this.prisma.conexion.findUnique({
      where: { id },
      select: { _count: { select: { ejecutables: true } } },
    });
    if (!c) throw new NotFoundException('La conexión no existe');
    return c;
  }

  async crear(dto: CrearEjecutableDto): Promise<EjecutableDto> {
    const pagina = await this.prisma.pagina.findUnique({
      where: { id: dto.paginaId },
      select: { id: true },
    });
    if (!pagina) {
      throw new NotFoundException('La página no existe');
    }
    await this.validarConexion(dto.conexionId);

    const ejecutable = await this.prisma.ejecutable.create({
      data: {
        paginaId: dto.paginaId,
        nombre: dto.nombre,
        tipo: dto.tipo,
        motor: dto.motor,
        conexionId: dto.conexionId ?? null,
        sentencia: dto.sentencia,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
      },
    });
    return this.aDto(ejecutable);
  }

  async actualizar(
    id: number,
    dto: ActualizarEjecutableDto,
  ): Promise<EjecutableDto> {
    await this.obtener(id);
    if (dto.conexionId !== undefined) {
      await this.validarConexion(dto.conexionId);
    }
    const ejecutable = await this.prisma.ejecutable.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        tipo: dto.tipo,
        motor: dto.motor,
        conexionId: dto.conexionId,
        sentencia: dto.sentencia,
        orden: dto.orden,
        activo: dto.activo,
      },
    });
    return this.aDto(ejecutable);
  }

  async eliminar(id: number): Promise<{ ok: true }> {
    await this.obtener(id);
    await this.prisma.ejecutable.delete({ where: { id } });
    return { ok: true };
  }

  private async obtener(id: number) {
    const ejecutable = await this.prisma.ejecutable.findUnique({
      where: { id },
    });
    if (!ejecutable) {
      throw new NotFoundException('El ejecutable no existe');
    }
    return ejecutable;
  }

  private async validarConexion(conexionId: number | null | undefined) {
    if (conexionId === null || conexionId === undefined) {
      return;
    }
    const conexion = await this.prisma.conexion.findUnique({
      where: { id: conexionId },
      select: { id: true },
    });
    if (!conexion) {
      throw new BadRequestException('La conexión indicada no existe');
    }
  }

  private aDto(e: Ejecutable): EjecutableDto {
    return {
      id: e.id,
      nombre: e.nombre,
      tipo: e.tipo,
      motor: e.motor,
      conexionId: e.conexionId,
      sentencia: e.sentencia,
      orden: e.orden,
      activo: e.activo,
    };
  }
}
