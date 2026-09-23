import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/utils/password';
import {
  rangoPaginacion,
  respuestaPaginada,
  type RespuestaPaginada,
} from '../common/utils/paginacion';
import { puedeAdministrarUsuarios } from '../common/utils/permisos-usuario';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarUsuarioDto,
  AsignarUsuarioLocalDto,
  CrearUsuarioDto,
  ListarUsuariosDto,
} from './dto/usuario.dto';
import type {
  MetaUsuariosDto,
  UsuarioLocalAsignacionDto,
  UsuarioAdminDto,
} from './interfaces/usuario-admin.interface';

const SELECT_USUARIO_ADMIN = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  nombreLogin: true,
  ruc: true,
  celular: true,
  esSuperadmin: true,
  isActive: true,
  createdAt: true,
  empresa: { select: { id: true, nombre: true } },
  rol: { select: { id: true, descripcion: true } },
  superior: { select: { id: true, nombre: true, apellido: true } },
} as const;

type UsuarioFila = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  nombreLogin: string;
  ruc: string;
  celular: string;
  esSuperadmin: boolean;
  isActive: boolean;
  createdAt: Date;
  empresa: { id: number; nombre: string };
  rol: { id: number; descripcion: string } | null;
  superior: { id: number; nombre: string; apellido: string } | null;
};

interface ContextoAdmin {
  id: number;
  empresaId: number;
  esSuperadmin: boolean;
}

const SELECT_LOCAL_USUARIO = {
  id: true,
  nombre: true,
  cliente: { select: { nombre: true } },
} as const;

function aUsuarioDto(usuario: UsuarioFila): UsuarioAdminDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    nombreLogin: usuario.nombreLogin,
    ruc: usuario.ruc,
    celular: usuario.celular,
    empresa: usuario.empresa,
    rol: usuario.rol,
    superior: usuario.superior
      ? {
          id: usuario.superior.id,
          nombre:
            `${usuario.superior.nombre} ${usuario.superior.apellido}`.trim(),
        }
      : null,
    esSuperadmin: usuario.esSuperadmin,
    isActive: usuario.isActive,
    createdAt: usuario.createdAt.toISOString(),
  };
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private async contexto(usuarioId: number): Promise<ContextoAdmin> {
    const actual = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        empresaId: true,
        esSuperadmin: true,
        isActive: true,
        rol: { select: { descripcion: true } },
      },
    });
    if (!actual || !actual.isActive) throw new UnauthorizedException();
    if (!actual.esSuperadmin) {
      const permitido = puedeAdministrarUsuarios(
        actual.esSuperadmin,
        actual.rol?.descripcion ?? null,
      );
      if (!permitido) {
        throw new ForbiddenException(
          'No tenés permiso para administrar usuarios',
        );
      }
    }
    return {
      id: actual.id,
      empresaId: actual.empresaId,
      esSuperadmin: actual.esSuperadmin,
    };
  }

  private empresaObjetivo(actual: ContextoAdmin, empresaId?: number): number {
    if (actual.esSuperadmin) return empresaId ?? actual.empresaId;
    if (empresaId !== undefined && empresaId !== actual.empresaId) {
      throw new ForbiddenException('No podés administrar otra empresa');
    }
    return actual.empresaId;
  }

  async listar(
    usuarioId: number,
    query: ListarUsuariosDto,
  ): Promise<RespuestaPaginada<UsuarioAdminDto>> {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, query.empresaId);
    const where = actual.esSuperadmin
      ? { empresaId }
      : { empresaId, esSuperadmin: false };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: SELECT_USUARIO_ADMIN,
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(usuarios.map(aUsuarioDto), total, page, limit);
  }

  async meta(usuarioId: number): Promise<MetaUsuariosDto> {
    const actual = await this.contexto(usuarioId);
    const empresas = await this.prisma.empresa.findMany({
      where: actual.esSuperadmin ? {} : { id: actual.empresaId },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
      take: 200,
    });
    return { empresas, esSuperadmin: actual.esSuperadmin };
  }

  async listarRoles(usuarioId: number, query: ListarUsuariosDto) {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, query.empresaId);
    const where = { empresaId };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.rol.count({ where }),
      this.prisma.rol.findMany({
        where,
        select: { id: true, descripcion: true },
        orderBy: [{ descripcion: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  async listarLocales(usuarioId: number, query: ListarUsuariosDto) {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, query.empresaId);
    const where = {
      cliente: {
        empresaId,
        ...(query.buscar
          ? { nombre: { contains: query.buscar, mode: 'insensitive' as const } }
          : {}),
      },
      ...(query.buscar
        ? { nombre: { contains: query.buscar, mode: 'insensitive' as const } }
        : {}),
      activo: true,
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, locales] = await Promise.all([
      this.prisma.localCampo.count({ where }),
      this.prisma.localCampo.findMany({
        where,
        select: SELECT_LOCAL_USUARIO,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      locales.map((local) => ({
        id: local.id,
        nombre: `${local.nombre} · ${local.cliente.nombre}`,
      })),
      total,
      page,
      limit,
    );
  }

  private async objetivoAsignable(usuarioId: number, objetivoId: number) {
    const actual = await this.contexto(usuarioId);
    const objetivo = await this.prisma.usuario.findFirst({
      where: {
        id: objetivoId,
        ...(actual.esSuperadmin ? {} : { empresaId: actual.empresaId }),
        esSuperadmin: false,
      },
      select: { id: true, empresaId: true, isActive: true },
    });
    if (!objetivo) throw new NotFoundException('El usuario no existe');
    return { actual, objetivo };
  }

  async listarAsignaciones(
    usuarioId: number,
    objetivoId: number,
    query: ListarUsuariosDto,
  ): Promise<RespuestaPaginada<UsuarioLocalAsignacionDto>> {
    await this.objetivoAsignable(usuarioId, objetivoId);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const where = { usuarioId: objetivoId, activo: true };
    const [total, asignaciones] = await Promise.all([
      this.prisma.asignacionCampo.count({ where }),
      this.prisma.asignacionCampo.findMany({
        where,
        select: {
          id: true,
          localId: true,
          fechaDesde: true,
          fechaHasta: true,
          local: { select: { nombre: true, cliente: { select: { nombre: true } } } },
        },
        orderBy: [{ fechaDesde: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      asignaciones.map((asignacion) => ({
        id: asignacion.id,
        localId: asignacion.localId,
        nombreLocal: asignacion.local.nombre,
        nombreCliente: asignacion.local.cliente.nombre,
        fechaDesde: asignacion.fechaDesde.toISOString(),
        fechaHasta: asignacion.fechaHasta?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async asignarLocal(
    usuarioId: number,
    objetivoId: number,
    dto: AsignarUsuarioLocalDto,
  ): Promise<UsuarioLocalAsignacionDto> {
    const { objetivo } = await this.objetivoAsignable(usuarioId, objetivoId);
    const local = await this.prisma.localCampo.findFirst({
      where: { id: dto.localId, cliente: { empresaId: objetivo.empresaId } },
      select: { id: true },
    });
    if (!local) throw new NotFoundException('El local no existe');
    const fechaDesde = new Date(`${dto.fechaDesde}T00:00:00.000Z`);
    const fechaHasta = dto.fechaHasta
      ? new Date(`${dto.fechaHasta}T00:00:00.000Z`)
      : null;
    if (fechaHasta && fechaHasta < fechaDesde) {
      throw new BadRequestException('La fecha hasta debe ser posterior al inicio');
    }
    const solapada = await this.prisma.asignacionCampo.findFirst({
      where: {
        localId: dto.localId,
        usuarioId: objetivoId,
        activo: true,
        fechaDesde: { lte: fechaHasta ?? new Date('9999-12-31') },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
      },
      select: { id: true },
    });
    if (solapada) throw new BadRequestException('Ese local ya está asignado en esas fechas');
    const asignacion = await this.prisma.asignacionCampo.create({
      data: { localId: dto.localId, usuarioId: objetivoId, fechaDesde, fechaHasta },
      select: {
        id: true,
        localId: true,
        fechaDesde: true,
        fechaHasta: true,
        local: { select: { nombre: true, cliente: { select: { nombre: true } } } },
      },
    });
    return {
      id: asignacion.id,
      localId: asignacion.localId,
      nombreLocal: asignacion.local.nombre,
      nombreCliente: asignacion.local.cliente.nombre,
      fechaDesde: asignacion.fechaDesde.toISOString(),
      fechaHasta: asignacion.fechaHasta?.toISOString() ?? null,
    };
  }

  async quitarLocal(usuarioId: number, objetivoId: number, asignacionId: number) {
    await this.objetivoAsignable(usuarioId, objetivoId);
    const resultado = await this.prisma.asignacionCampo.updateMany({
      where: { id: asignacionId, usuarioId: objetivoId, activo: true },
      data: { activo: false },
    });
    if (!resultado.count) throw new NotFoundException('La asignación no existe');
    return { ok: true };
  }

  private async validarAsignaciones(
    empresaId: number,
    rolId: number,
    superiorId?: number | null,
    usuarioEditadoId?: number,
  ): Promise<void> {
    const [rol, superior] = await Promise.all([
      this.prisma.rol.findUnique({
        where: { id: rolId },
        select: { id: true, empresaId: true, rolId: true },
      }),
      superiorId
        ? this.prisma.usuario.findUnique({
            where: { id: superiorId },
            select: {
              id: true,
              empresaId: true,
              isActive: true,
              rolId: true,
              superiorId: true,
            },
          })
        : null,
    ]);
    if (!rol || rol.empresaId !== empresaId) {
      throw new NotFoundException(
        'El rol no está disponible para esta empresa',
      );
    }
    if (
      superiorId &&
      (!superior ||
        !superior.isActive ||
        superior.empresaId !== empresaId ||
        superior.id === usuarioEditadoId)
    ) {
      throw new NotFoundException('El superior no existe');
    }
    if (superior && rol?.rolId && superior.rolId !== rol.rolId)
      throw new BadRequestException('El superior debe tener el rol padre del usuario');
    if (usuarioEditadoId !== undefined && superior) {
      const visitados = new Set<number>([usuarioEditadoId]);
      let actual: number | null = superior.id;
      while (actual !== null) {
        if (visitados.has(actual))
          throw new BadRequestException('La jerarquía de usuarios formaría un ciclo');
        visitados.add(actual);
        const padre: { superiorId: number | null } | null =
          actual === superior.id
            ? superior
            : await this.prisma.usuario.findUnique({
                where: { id: actual },
                select: { superiorId: true },
              });
        actual = padre?.superiorId ?? null;
      }
    }
  }

  async crear(
    usuarioId: number,
    dto: CrearUsuarioDto,
  ): Promise<UsuarioAdminDto> {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, dto.empresaId);
    if (dto.esSuperadmin && !actual.esSuperadmin) {
      throw new ForbiddenException(
        'Solo un superadministrador puede otorgar ese permiso',
      );
    }
    await this.validarAsignaciones(empresaId, dto.rolId, dto.superiorId);
    const creado = await this.auth.crearUsuario(
      { ...dto, empresaId },
      {
        rolId: dto.rolId,
        superiorId: dto.superiorId,
        esSuperadmin: dto.esSuperadmin,
      },
    );
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: creado.id },
      select: SELECT_USUARIO_ADMIN,
    });
    if (!usuario) throw new NotFoundException('El usuario no existe');
    return aUsuarioDto(usuario);
  }

  async actualizar(
    usuarioId: number,
    id: number,
    dto: ActualizarUsuarioDto,
  ): Promise<UsuarioAdminDto> {
    const actual = await this.contexto(usuarioId);
    const objetivo = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        empresaId: true,
        rolId: true,
        superiorId: true,
        esSuperadmin: true,
      },
    });
    if (
      !objetivo ||
      objetivo.esSuperadmin ||
      (!actual.esSuperadmin && objetivo.empresaId !== actual.empresaId)
    ) {
      throw new NotFoundException('El usuario no existe');
    }
    const rolId = dto.rolId ?? objetivo.rolId;
    if (rolId === null) throw new BadRequestException('El rol es obligatorio');
    await this.validarAsignaciones(
      objetivo.empresaId,
      rolId,
      dto.superiorId === undefined ? objetivo.superiorId : dto.superiorId,
      id,
    );
    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: {
        rolId: dto.rolId,
        superiorId: dto.superiorId,
        isActive: dto.isActive,
        passwordHash: dto.password
          ? await hashPassword(dto.password)
          : undefined,
      },
      select: SELECT_USUARIO_ADMIN,
    });
    return aUsuarioDto(usuario);
  }

  // Conserva el registro de la cuenta y bloquea inmediatamente el acceso.
  async eliminar(usuarioId: number, id: number): Promise<{ ok: true }> {
    const actual = await this.contexto(usuarioId);
    const objetivo = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, empresaId: true, esSuperadmin: true },
    });
    if (
      !objetivo ||
      objetivo.esSuperadmin ||
      (!actual.esSuperadmin && objetivo.empresaId !== actual.empresaId)
    ) {
      throw new NotFoundException('El usuario no existe');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { isActive: false },
      select: { id: true },
    });
    return { ok: true };
  }
}
