import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  ErrorLoteUsuario,
  FilaLoteUsuarios,
  ResultadoLoteUsuarios,
} from './interfaces/lote-usuarios.interface';
import { loginDesdeCorreo, mensajeErrorLote } from './utils/lote-usuarios';
import { PASSWORD_POR_DEFECTO } from './usuarios.constants';
import { AuthService } from '../auth/auth.service';
import {
  MENSAJES_DUPLICADO,
  normalizarCelular,
  normalizarRucUsuario,
} from '../auth/utils/datos-usuario';
import { hashPassword } from '../auth/utils/password';
import {
  rangoPaginacion,
  respuestaPaginada,
  type RespuestaPaginada,
} from '../common/utils/paginacion';
import { puedeAdministrarUsuarios } from '../common/utils/permisos-usuario';
import { filtrosBusquedaUsuario } from '../common/utils/busqueda-usuario';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarUsuarioDto,
  ActualizarUsuarioLoteDto,
  AsignarUsuarioLocalDto,
  CrearUsuarioDto,
  DesactivarUsuarioLoteDto,
  ListarUsuariosDto,
} from './dto/usuario.dto';
import type {
  MetaUsuariosDto,
  UsuarioLocalAsignacionDto,
  UsuarioAdminDto,
} from './interfaces/usuario-admin.interface';
import { ListarSuperioresDto } from './dto/listar-superiores.dto';
import { relanzarDuplicado } from '../common/utils/error-prisma';
import { existsSync, unlinkSync } from 'fs';
import {
  resolverRutaFoto,
  validarArchivoImagen,
} from '../campo/utils/multer-config';
import { CARPETA_FOTOS_PERFIL } from './utils/multer-foto-perfil';
import type { ActualizarPerfilDto } from './dto/perfil.dto';
import { filtroLocales, nombreLocal } from '../campo/utils/local-ocrd';

const SELECT_USUARIO_ADMIN = {
  id: true,
  nombre: true,
  apellido: true,
  correo: true,
  nombreLogin: true,
  ruc: true,
  celular: true,
  legajo: true,
  ERP_CanalVenta: true,
  ERP_Almacen: true,
  ERP_Supervisor: true,
  ERP_Vendedor: true,
  ERP_Repositor: true,
  ERP_Impulsador: true,
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
  ruc: string | null;
  celular: string;
  legajo: string | null;
  ERP_CanalVenta: string | null;
  ERP_Almacen: string | null;
  ERP_Supervisor: string | null;
  ERP_Vendedor: number | null;
  ERP_Repositor: string | null;
  ERP_Impulsador: string | null;
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

function aUsuarioDto(usuario: UsuarioFila): UsuarioAdminDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    nombreLogin: usuario.nombreLogin,
    ruc: usuario.ruc,
    celular: usuario.celular,
    legajo: usuario.legajo,
    ERP_CanalVenta: usuario.ERP_CanalVenta,
    ERP_Almacen: usuario.ERP_Almacen,
    ERP_Supervisor: usuario.ERP_Supervisor,
    ERP_Vendedor: usuario.ERP_Vendedor,
    ERP_Repositor: usuario.ERP_Repositor,
    ERP_Impulsador: usuario.ERP_Impulsador,
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
    const where: Prisma.UsuarioWhereInput = {
      empresaId,
      ...(actual.esSuperadmin ? {} : { esSuperadmin: false }),
      AND: filtrosBusquedaUsuario(query.buscar, true),
    };
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

  async listarSuperiores(usuarioId: number, query: ListarSuperioresDto) {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, query.empresaId);
    const rol = await this.prisma.rol.findUnique({
      where: { id: query.rolId },
      select: { empresaId: true, rolId: true },
    });
    if (!rol || rol.empresaId !== empresaId)
      throw new NotFoundException(
        'El rol no está disponible para esta empresa',
      );
    const { skip, take, page, limit } = rangoPaginacion(query);
    if (rol.rolId === null) return respuestaPaginada([], 0, page, limit);
    const where: Prisma.UsuarioWhereInput = {
      empresaId,
      rolId: rol.rolId,
      isActive: true,
      esSuperadmin: false,
      ...(query.excluirUsuarioId
        ? { id: { not: query.excluirUsuarioId } }
        : {}),
      AND: filtrosBusquedaUsuario(query.buscar),
    };
    const [total, superiores] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: { id: true, nombre: true, apellido: true },
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      superiores.map((u) => ({
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`.trim(),
      })),
      total,
      page,
      limit,
    );
  }

  async listarLocales(usuarioId: number, query: ListarUsuariosDto) {
    const actual = await this.contexto(usuarioId);
    const empresaId = this.empresaObjetivo(actual, query.empresaId);
    const where = filtroLocales(empresaId, query.buscar);
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, locales] = await Promise.all([
      this.prisma.socioNegocio.count({ where }),
      this.prisma.socioNegocio.findMany({
        where,
        select: { CardCode: true, CardName: true },
        orderBy: [{ CardName: 'asc' }, { CardCode: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      locales.map((local) => ({
        id: local.CardCode,
        nombre: `${nombreLocal(local)} · ${local.CardCode}`,
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
          local: { select: { CardCode: true, CardName: true } },
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
        nombreLocal: nombreLocal(asignacion.local),
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
    const local = await this.prisma.socioNegocio.findFirst({
      where: { CardCode: dto.localId, empresaId: objetivo.empresaId },
      select: { CardCode: true },
    });
    if (!local) throw new NotFoundException('El local no existe');
    const fechaDesde = new Date(`${dto.fechaDesde}T00:00:00.000Z`);
    const fechaHasta = dto.fechaHasta
      ? new Date(`${dto.fechaHasta}T00:00:00.000Z`)
      : null;
    if (fechaHasta && fechaHasta < fechaDesde) {
      throw new BadRequestException(
        'La fecha hasta debe ser posterior al inicio',
      );
    }
    const solapada = await this.prisma.asignacionCampo.findFirst({
      where: {
        empresaId: objetivo.empresaId,
        localId: dto.localId,
        usuarioId: objetivoId,
        activo: true,
        fechaDesde: { lte: fechaHasta ?? new Date('9999-12-31') },
        OR: [{ fechaHasta: null }, { fechaHasta: { gte: fechaDesde } }],
      },
      select: { id: true },
    });
    if (solapada)
      throw new BadRequestException(
        'Ese local ya está asignado en esas fechas',
      );
    const asignacion = await this.prisma.asignacionCampo.create({
      data: {
        empresaId: objetivo.empresaId,
        localId: dto.localId,
        usuarioId: objetivoId,
        fechaDesde,
        fechaHasta,
      },
      select: {
        id: true,
        localId: true,
        fechaDesde: true,
        fechaHasta: true,
        local: { select: { CardCode: true, CardName: true } },
      },
    });
    return {
      id: asignacion.id,
      localId: asignacion.localId,
      nombreLocal: nombreLocal(asignacion.local),
      fechaDesde: asignacion.fechaDesde.toISOString(),
      fechaHasta: asignacion.fechaHasta?.toISOString() ?? null,
    };
  }

  async quitarLocal(
    usuarioId: number,
    objetivoId: number,
    asignacionId: number,
  ) {
    await this.objetivoAsignable(usuarioId, objetivoId);
    const resultado = await this.prisma.asignacionCampo.updateMany({
      where: { id: asignacionId, usuarioId: objetivoId, activo: true },
      data: { activo: false },
    });
    if (!resultado.count)
      throw new NotFoundException('La asignación no existe');
    return { ok: true };
  }

  private async validarAsignaciones(
    empresaId: number,
    rolId: number | null,
    superiorId?: number | null,
    usuarioEditadoId?: number,
  ): Promise<void> {
    // Sin rol no hay organigrama contra el cual validar al superior.
    if (rolId === null) {
      if (superiorId)
        throw new BadRequestException(
          'Para asignar un superior, el usuario necesita un rol',
        );
      return;
    }
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
              esSuperadmin: true,
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
        superior.esSuperadmin ||
        superior.empresaId !== empresaId ||
        superior.id === usuarioEditadoId)
    ) {
      throw new NotFoundException('El superior no existe');
    }
    if (superior && rol.rolId === null)
      throw new BadRequestException(
        'Este rol no tiene un superior definido en el organigrama',
      );
    if (superior && superior.rolId !== rol.rolId)
      throw new BadRequestException(
        'El superior debe tener el rol padre del usuario',
      );
    if (usuarioEditadoId !== undefined && superior) {
      const visitados = new Set<number>([usuarioEditadoId]);
      let actual: number | null = superior.id;
      while (actual !== null) {
        if (visitados.has(actual))
          throw new BadRequestException(
            'La jerarquía de usuarios formaría un ciclo',
          );
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
    return this.crearCon(await this.contexto(usuarioId), dto);
  }

  async crearLote(
    usuarioId: number,
    filas: FilaLoteUsuarios<CrearUsuarioDto>[],
  ): Promise<ResultadoLoteUsuarios<UsuarioAdminDto>> {
    const actual = await this.contexto(usuarioId);
    let hashPorDefecto: Promise<string> | undefined;
    return procesarLote(
      filas,
      (dto) =>
        this.crearCon(
          actual,
          dto,
          dto.password
            ? undefined
            : (hashPorDefecto ??= hashPassword(PASSWORD_POR_DEFECTO)),
        ),
      (dto) => ({ usuario: dto.nombreLogin ?? dto.correo }),
    );
  }

  // Completa lo que falte: usuario desde el correo (o uno generado), correo
  // interno no entregable, nombre = usuario y la contraseña por defecto.
  private async crearCon(
    actual: ContextoAdmin,
    dto: CrearUsuarioDto,
    passwordHash?: Promise<string>,
  ): Promise<UsuarioAdminDto> {
    const empresaId = this.empresaObjetivo(actual, dto.empresaId);
    if (dto.esSuperadmin && !actual.esSuperadmin) {
      throw new ForbiddenException(
        'Solo un superadministrador puede otorgar ese permiso',
      );
    }
    await this.validarAsignaciones(
      empresaId,
      dto.rolId ?? null,
      dto.superiorId,
    );
    const nombreLogin =
      dto.nombreLogin ??
      loginDesdeCorreo(dto.correo) ??
      `usuario-${randomBytes(4).toString('hex')}`;
    const creado = await this.auth.crearUsuario(
      {
        ...dto,
        empresaId,
        nombreLogin,
        correo: dto.correo ?? `${nombreLogin}@sin-correo.invalid`,
        nombre: dto.nombre ?? nombreLogin,
        apellido: dto.apellido ?? '',
        password: dto.password ?? PASSWORD_POR_DEFECTO,
      },
      {
        rolId: dto.rolId ?? null,
        superiorId: dto.superiorId,
        esSuperadmin: dto.esSuperadmin,
      },
      passwordHash ? await passwordHash : undefined,
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
    return this.actualizarCon(await this.contexto(usuarioId), id, dto);
  }

  async actualizarLote(
    usuarioId: number,
    filas: FilaLoteUsuarios<ActualizarUsuarioLoteDto>[],
  ): Promise<ResultadoLoteUsuarios<UsuarioAdminDto>> {
    const actual = await this.contexto(usuarioId);
    return procesarLote(
      filas,
      ({ id, ...dto }) => this.actualizarCon(actual, id, dto),
      (dto) => ({ id: dto.id }),
    );
  }

  private async actualizarCon(
    actual: ContextoAdmin,
    id: number,
    dto: ActualizarUsuarioDto,
  ): Promise<UsuarioAdminDto> {
    const objetivo = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        empresaId: true,
        rolId: true,
        superiorId: true,
        esSuperadmin: true,
        correo: true,
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
    await this.validarAsignaciones(
      objetivo.empresaId,
      rolId,
      dto.superiorId === undefined ? objetivo.superiorId : dto.superiorId,
      id,
    );
    // Mismas reglas que el alta: RUC con dígito verificador y celular en E.164.
    const ruc =
      dto.ruc === undefined
        ? undefined
        : normalizarRucUsuario(dto.ruc, dto.celularPais ?? 'PY');
    const celular =
      dto.celular === undefined
        ? undefined
        : normalizarCelular(dto.celular, dto.celularPais ?? 'PY');
    const unicos = [
      dto.correo === undefined ? null : { correo: dto.correo },
      dto.nombreLogin === undefined ? null : { nombreLogin: dto.nombreLogin },
      ruc === undefined ? null : { ruc },
    ].filter((f) => f !== null);
    const duplicado = unicos.length
      ? await this.prisma.usuario.findFirst({
          where: { id: { not: id }, OR: unicos },
          select: { correo: true, nombreLogin: true, ruc: true },
        })
      : null;
    if (duplicado)
      throw new ConflictException(
        duplicado.correo === dto.correo
          ? MENSAJES_DUPLICADO.correo
          : duplicado.nombreLogin === dto.nombreLogin
            ? MENSAJES_DUPLICADO.nombre_login
            : MENSAJES_DUPLICADO.ruc,
      );
    try {
      const usuario = await this.prisma.usuario.update({
        where: { id },
        data: {
          correo: dto.correo,
          nombre: dto.nombre,
          apellido: dto.apellido,
          nombreLogin: dto.nombreLogin,
          ruc,
          celular,
          legajo: dto.legajo,
          ERP_CanalVenta: dto.ERP_CanalVenta,
          ERP_Almacen: dto.ERP_Almacen,
          ERP_Supervisor: dto.ERP_Supervisor,
          ERP_Vendedor: dto.ERP_Vendedor,
          ERP_Repositor: dto.ERP_Repositor,
          ERP_Impulsador: dto.ERP_Impulsador,
          rolId: dto.rolId,
          superiorId: dto.superiorId,
          isActive: dto.isActive,
          passwordHash: dto.password
            ? await hashPassword(dto.password)
            : undefined,
        },
        select: SELECT_USUARIO_ADMIN,
      });
      // El SSO de Ucheck entra por el vínculo guardado, no por el correo: si la
      // cuenta cambia de correo, el vínculo viejo llevaría a la persona anterior.
      if (
        dto.correo &&
        dto.correo.toLowerCase() !== objetivo.correo.toLowerCase()
      )
        await this.prisma.identidadUcheck.deleteMany({
          where: { usuarioId: id },
        });
      return aUsuarioDto(usuario);
    } catch (error: unknown) {
      relanzarDuplicado(
        error,
        'Ya existe un usuario con ese correo, nombre de usuario o RUC',
      );
    }
  }

  /**
   * "Mis datos": cada usuario cambia solo su nombre, apellido, correo, RUC y
   * celular, con las mismas reglas que el ABM (RUC con dígito y celular E.164).
   */
  async actualizarPerfil(
    usuarioId: number,
    dto: ActualizarPerfilDto,
  ): Promise<void> {
    const ruc =
      dto.ruc === undefined
        ? undefined
        : normalizarRucUsuario(dto.ruc, dto.celularPais ?? 'PY');
    const celular =
      dto.celular === undefined
        ? undefined
        : normalizarCelular(dto.celular, dto.celularPais ?? 'PY');
    const unicos = [
      dto.correo === undefined ? null : { correo: dto.correo },
      ruc === undefined ? null : { ruc },
    ].filter((f) => f !== null);
    const duplicado = unicos.length
      ? await this.prisma.usuario.findFirst({
          where: { id: { not: usuarioId }, OR: unicos },
          select: { correo: true },
        })
      : null;
    if (duplicado)
      throw new ConflictException(
        duplicado.correo === dto.correo
          ? MENSAJES_DUPLICADO.correo
          : MENSAJES_DUPLICADO.ruc,
      );
    try {
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          correo: dto.correo,
          ruc,
          celular,
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      relanzarDuplicado(error, 'Ya existe un usuario con ese correo o RUC');
    }
  }

  /** Guarda la foto de perfil propia y borra la anterior del disco. */
  async guardarFotoPerfil(
    usuarioId: number,
    file: Express.Multer.File,
  ): Promise<void> {
    validarArchivoImagen(file);
    const anterior = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { fotoPerfil: true },
    });
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        fotoPerfil: `${CARPETA_FOTOS_PERFIL}/${file.filename}`,
        fotoPerfilMime: file.mimetype,
      },
      select: { id: true },
    });
    if (anterior?.fotoPerfil) borrarArchivo(anterior.fotoPerfil);
  }

  async quitarFotoPerfil(usuarioId: number): Promise<void> {
    const anterior = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { fotoPerfil: true },
    });
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoPerfil: null, fotoPerfilMime: null },
      select: { id: true },
    });
    if (anterior?.fotoPerfil) borrarArchivo(anterior.fotoPerfil);
  }

  /** Ruta en disco y tipo de la foto propia; null si no tiene o se perdió el archivo. */
  async fotoPerfil(
    usuarioId: number,
  ): Promise<{ ruta: string; mime: string } | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { fotoPerfil: true, fotoPerfilMime: true },
    });
    if (!usuario?.fotoPerfil) return null;
    const ruta = resolverRutaFoto(usuario.fotoPerfil);
    return existsSync(ruta)
      ? { ruta, mime: usuario.fotoPerfilMime ?? 'image/jpeg' }
      : null;
  }

  async eliminar(usuarioId: number, id: number): Promise<{ ok: true }> {
    return this.eliminarCon(await this.contexto(usuarioId), id);
  }

  async eliminarLote(
    usuarioId: number,
    filas: FilaLoteUsuarios<DesactivarUsuarioLoteDto>[],
  ): Promise<ResultadoLoteUsuarios<{ id: number }>> {
    const actual = await this.contexto(usuarioId);
    return procesarLote(
      filas,
      async ({ id }) => {
        await this.eliminarCon(actual, id);
        return { id };
      },
      (dto) => ({ id: dto.id }),
    );
  }

  // Conserva el registro de la cuenta y bloquea inmediatamente el acceso.
  private async eliminarCon(
    actual: ContextoAdmin,
    id: number,
  ): Promise<{ ok: true }> {
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

// Cada fila se procesa sola, en orden: un error no frena a las demás y queda
// al final de la respuesta con su motivo.
async function procesarLote<T, R>(
  filas: FilaLoteUsuarios<T>[],
  hacer: (dto: T) => Promise<R>,
  quien: (dto: T) => { id?: number; usuario?: string },
): Promise<ResultadoLoteUsuarios<R>> {
  const resultados: R[] = [];
  const errores: ErrorLoteUsuario[] = [];
  for (const [indice, fila] of filas.entries()) {
    if ('error' in fila) {
      errores.push({ indice, error: fila.error });
      continue;
    }
    try {
      resultados.push(await hacer(fila.dto));
    } catch (error: unknown) {
      errores.push({
        indice,
        ...quien(fila.dto),
        error: mensajeErrorLote(error),
      });
    }
  }
  return {
    total: filas.length,
    exitosos: resultados.length,
    fallidos: errores.length,
    resultados,
    errores,
  };
}

function borrarArchivo(relativa: string): void {
  try {
    unlinkSync(resolverRutaFoto(relativa));
  } catch {
    // Si ya no estaba en el disco no hay nada que limpiar.
  }
}
