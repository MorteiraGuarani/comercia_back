import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './utils/password';
import {
  MENSAJES_DUPLICADO,
  normalizarCelular,
  normalizarNumeroSim,
  normalizarRucUsuario,
} from './utils/datos-usuario';
import { LoginSimDto } from './dto/login-sim.dto';
import { puedeAdministrarUsuarios } from '../common/utils/permisos-usuario';
import type { UsuarioSesion } from './interfaces/usuario-sesion.interface';
import type { TokenPayload } from './interfaces/token-payload.interface';
import type { AsignacionUsuario } from './interfaces/asignacion-usuario.interface';
import {
  camposDuplicados,
  esErrorDuplicado,
} from '../common/utils/error-prisma';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async crearUsuario(
    dto: Omit<RegisterDto, 'ruc' | 'celular' | 'celularPais'> & {
      ruc?: string | null;
      celular?: string | null;
      celularPais?: string;
      legajo?: string | null;
    },
    asignacion: AsignacionUsuario,
    // Un lote con la contraseña por defecto la hashea una sola vez.
    passwordHashPrevio?: string,
  ): Promise<UsuarioSesion> {
    const pais = dto.celularPais ?? 'PY';
    const celularE164 = dto.celular ? normalizarCelular(dto.celular, pais) : '';
    const ruc = dto.ruc ? normalizarRucUsuario(dto.ruc, pais) : null;

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      select: { id: true },
    });
    if (!empresa) {
      throw new BadRequestException('La empresa seleccionada no existe');
    }

    // Chequeos amables (la garantía real son los índices únicos + catch P2002)
    const duplicado = await this.prisma.usuario.findFirst({
      where: {
        OR: [
          { correo: dto.correo },
          { nombreLogin: dto.nombreLogin },
          ...(ruc ? [{ ruc }] : []),
        ],
      },
      select: { correo: true, nombreLogin: true, ruc: true },
    });
    if (duplicado) {
      if (duplicado.correo === dto.correo) {
        throw new ConflictException(MENSAJES_DUPLICADO.correo);
      }
      if (duplicado.nombreLogin === dto.nombreLogin) {
        throw new ConflictException(MENSAJES_DUPLICADO.nombre_login);
      }
      throw new ConflictException(MENSAJES_DUPLICADO.ruc);
    }

    const passwordHash =
      passwordHashPrevio ?? (await hashPassword(dto.password));
    const usuario = await this.prisma.usuario
      .create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          correo: dto.correo,
          nombreLogin: dto.nombreLogin,
          empresaId: dto.empresaId,
          rolId: asignacion.rolId,
          superiorId: asignacion.superiorId ?? null,
          esSuperadmin: asignacion.esSuperadmin ?? false,
          ruc,
          celular: celularE164,
          legajo: dto.legajo ?? null,
          passwordHash,
        },
        include: { empresa: true, rol: { include: { equipoCampo: true } } },
      })
      .catch((e: unknown) => {
        // Carrera entre el chequeo y el insert: el índice único manda (409, no 500)
        if (esErrorDuplicado(e)) {
          const campos = camposDuplicados(e);
          const mensaje = campos
            .map((c) => MENSAJES_DUPLICADO[c])
            .find((m) => m !== undefined);
          throw new ConflictException(
            mensaje ?? 'Ya existe un usuario con esos datos',
          );
        }
        throw e;
      });

    return this.aSesion(usuario);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ usuario: UsuarioSesion; token: string }> {
    // El identificador llega en minúsculas (DTO); correo y nombreLogin se
    // Se guardan en minúsculas al crear el usuario: misma normalización aquí.
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ correo: dto.identificador }, { nombreLogin: dto.identificador }],
      },
      include: { empresa: true, rol: { include: { equipoCampo: true } } },
    });

    // Mismo mensaje exista o no el usuario: no revelar quiénes están registrados
    const credencialesInvalidas = new UnauthorizedException(
      'Usuario o contraseña incorrectos',
    );
    if (!usuario || !usuario.isActive) {
      throw credencialesInvalidas;
    }
    const passwordOk = await verifyPassword(dto.password, usuario.passwordHash);
    if (!passwordOk) {
      throw credencialesInvalidas;
    }

    return {
      usuario: this.aSesion(usuario),
      token: this.firmarToken(usuario.id),
    };
  }

  async loginMovilConSim(
    dto: LoginSimDto,
  ): Promise<{ usuario: UsuarioSesion; token: string }> {
    const credencialesInvalidas = new UnauthorizedException(
      'No se pudo iniciar sesión automáticamente',
    );
    // El número lo informa el teléfono y la API no puede comprobar que la SIM
    // esté presente: con esto encendido, saber el celular de alguien alcanza
    // para entrar como esa persona. Apagado responde igual que un número
    // desconocido, así la app vuelve al login con contraseña.
    if (!this.config.get<boolean>('security.loginSimHabilitado')) {
      throw credencialesInvalidas;
    }
    const telefonos = [
      ...new Set(
        dto.telefonos
          .map(normalizarNumeroSim)
          .filter((telefono): telefono is string => telefono !== null),
      ),
    ];
    if (telefonos.length === 0) throw credencialesInvalidas;

    // No elegir arbitrariamente si dos SIMs pertenecen a usuarios distintos.
    // Es un endpoint público deliberado, equivalente al login móvil, porque la
    // app necesita resolver el fallback antes de contar con un JWT.
    const usuarios = await this.prisma.usuario.findMany({
      where: { celular: { in: telefonos } },
      include: { empresa: true, rol: { include: { equipoCampo: true } } },
      take: 2,
    });
    if (usuarios.length !== 1 || !usuarios[0].isActive) {
      throw credencialesInvalidas;
    }

    const usuario = usuarios[0];
    return {
      usuario: this.aSesion(usuario),
      token: this.firmarToken(usuario.id),
    };
  }

  async me(usuarioId: number): Promise<UsuarioSesion> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { empresa: true, rol: { include: { equipoCampo: true } } },
    });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }
    return this.aSesion(usuario);
  }

  async iniciarSesionPorUsuarioId(
    usuarioId: number,
  ): Promise<{ usuario: UsuarioSesion; token: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { empresa: true, rol: { include: { equipoCampo: true } } },
    });
    if (!usuario?.isActive) {
      throw new UnauthorizedException(
        'La cuenta de Comercia no está habilitada',
      );
    }
    return {
      usuario: this.aSesion(usuario),
      token: this.firmarToken(usuario.id),
    };
  }

  private firmarToken(usuarioId: number): string {
    const payload: TokenPayload = { sub: usuarioId };
    return this.jwt.sign(payload);
  }

  private aSesion(usuario: {
    id: number;
    nombre: string;
    apellido: string;
    correo: string;
    nombreLogin: string;
    ruc: string | null;
    celular: string;
    legajo: string | null;
    fotoPerfil: string | null;
    updatedAt: Date;
    esSuperadmin: boolean;
    empresa: { id: number; nombre: string };
    rol: {
      id: number;
      descripcion: string;
      equipoCampo: {
        id: number;
        nombre: string;
        tipo: import('../../generated/prisma/client').DestinatarioTareaCampo;
        activo: boolean;
      } | null;
    } | null;
  }): UsuarioSesion {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      nombreLogin: usuario.nombreLogin,
      ruc: usuario.ruc,
      celular: usuario.celular,
      legajo: usuario.legajo,
      fotoPerfilVersion: usuario.fotoPerfil
        ? usuario.updatedAt.toISOString()
        : null,
      esSuperadmin: usuario.esSuperadmin,
      puedeAdministrarUsuarios: puedeAdministrarUsuarios(
        usuario.esSuperadmin,
        usuario.rol?.descripcion ?? null,
      ),
      empresa: { id: usuario.empresa.id, nombre: usuario.empresa.nombre },
      rol: usuario.rol
        ? {
            id: usuario.rol.id,
            descripcion: usuario.rol.descripcion,
            equipoCampo: usuario.rol.equipoCampo
              ? {
                  id: usuario.rol.equipoCampo.id,
                  nombre: usuario.rol.equipoCampo.nombre,
                  tipo: usuario.rol.equipoCampo.tipo,
                  activo: usuario.rol.equipoCampo.activo,
                }
              : null,
          }
        : null,
    };
  }
}
