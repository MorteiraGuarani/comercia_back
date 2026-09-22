import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './utils/password';
import {
  normalizarCelular,
  normalizarNumeroSim,
  normalizarRucUsuario,
} from './utils/datos-usuario';
import { LoginSimDto } from './dto/login-sim.dto';
import { puedeAdministrarUsuarios } from '../common/utils/permisos-usuario';
import type { UsuarioSesion } from './interfaces/usuario-sesion.interface';
import type { TokenPayload } from './interfaces/token-payload.interface';
import type { AsignacionUsuario } from './interfaces/asignacion-usuario.interface';

const MENSAJES_DUPLICADO: Record<string, string> = {
  correo: 'Ya existe un usuario registrado con ese correo',
  nombre_login: 'Ese nombre de usuario ya está en uso',
  ruc: 'Ya existe un usuario registrado con ese RUC',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async crearUsuario(
    dto: RegisterDto,
    asignacion: AsignacionUsuario,
  ): Promise<UsuarioSesion> {
    const celularE164 = normalizarCelular(dto.celular, dto.celularPais);
    const ruc = normalizarRucUsuario(dto.ruc, dto.celularPais);

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
        OR: [{ correo: dto.correo }, { nombreLogin: dto.nombreLogin }, { ruc }],
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

    const passwordHash = await hashPassword(dto.password);
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
          passwordHash,
        },
        include: { empresa: true, rol: true },
      })
      .catch((e: unknown) => {
        // Carrera entre el chequeo y el insert: el índice único manda (409, no 500)
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const campos = (e.meta?.target as string[] | undefined) ?? [];
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
      include: { empresa: true, rol: true },
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
    const telefonos = [
      ...new Set(
        dto.telefonos
          .map(normalizarNumeroSim)
          .filter((telefono): telefono is string => telefono !== null),
      ),
    ];
    const credencialesInvalidas = new UnauthorizedException(
      'No se pudo iniciar sesión automáticamente',
    );
    if (telefonos.length === 0) throw credencialesInvalidas;

    // No elegir arbitrariamente si dos SIMs pertenecen a usuarios distintos.
    // Es un endpoint público deliberado, equivalente al login móvil, porque la
    // app necesita resolver el fallback antes de contar con un JWT.
    const usuarios = await this.prisma.usuario.findMany({
      where: { celular: { in: telefonos } },
      include: { empresa: true, rol: true },
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
      include: { empresa: true, rol: true },
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
      include: { empresa: true, rol: true },
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
    ruc: string;
    celular: string;
    esSuperadmin: boolean;
    empresa: { id: number; nombre: string };
    rol: { id: number; descripcion: string } | null;
  }): UsuarioSesion {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      nombreLogin: usuario.nombreLogin,
      ruc: usuario.ruc,
      celular: usuario.celular,
      esSuperadmin: usuario.esSuperadmin,
      puedeAdministrarUsuarios: puedeAdministrarUsuarios(
        usuario.esSuperadmin,
        usuario.rol?.descripcion ?? null,
      ),
      empresa: { id: usuario.empresa.id, nombre: usuario.empresa.nombre },
      rol: usuario.rol
        ? { id: usuario.rol.id, descripcion: usuario.rol.descripcion }
        : null,
    };
  }
}
