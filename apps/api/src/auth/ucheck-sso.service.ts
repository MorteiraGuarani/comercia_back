import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { IdentidadUcheckCanjeada } from './interfaces/identidad-ucheck.interface';
import { AuthService } from './auth.service';
import { destinoSsoSeguro } from './utils/destino-sso';
import { esIdentidadUcheck } from './utils/identidad-ucheck';

const TIEMPO_ESPERA_MS = 5_000;

@Injectable()
export class UcheckSsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  async iniciarSesion(codigo: string) {
    const identidad = await this.canjear(codigo);
    const usuarioId = await this.vincularUsuario(identidad);
    const sesion = await this.auth.iniciarSesionPorUsuarioId(usuarioId);
    const frontendUrl = this.config.getOrThrow<string>('app.frontendUrl');
    return {
      ...sesion,
      destino: destinoSsoSeguro(identidad.destino, frontendUrl),
    };
  }

  private async canjear(codigo: string): Promise<IdentidadUcheckCanjeada> {
    const apiUrl = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSsoSecret');
    if (!apiUrl || !secreto) {
      throw new ServiceUnavailableException(
        'El SSO con UCHECK no está configurado',
      );
    }

    const controlador = new AbortController();
    const temporizador = setTimeout(
      () => controlador.abort(),
      TIEMPO_ESPERA_MS,
    );
    try {
      const respuesta = await fetch(
        `${apiUrl.replace(/\/$/, '')}/sso/comercia/exchange`,
        {
          method: 'POST',
          signal: controlador.signal,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${secreto}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ codigo }),
        },
      );
      if (respuesta.status === 401) {
        throw new UnauthorizedException('El acceso SSO venció o ya fue usado');
      }
      if (!respuesta.ok) {
        throw new ServiceUnavailableException(
          'UCHECK no pudo validar el acceso SSO',
        );
      }
      const cuerpo: unknown = await respuesta.json();
      if (!esIdentidadUcheck(cuerpo)) {
        throw new ServiceUnavailableException(
          'UCHECK devolvió una identidad SSO inválida',
        );
      }
      return { ...cuerpo, correo: cuerpo.correo.trim().toLowerCase() };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'No se pudo conectar con UCHECK para validar el acceso',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  private async vincularUsuario(
    identidad: IdentidadUcheckCanjeada,
  ): Promise<number> {
    const existente = await this.prisma.identidadUcheck.findUnique({
      where: { ucheckUsuarioId: identidad.usuarioId },
      select: {
        usuario: { select: { id: true, isActive: true } },
      },
    });
    if (existente) {
      if (!existente.usuario.isActive) {
        throw new UnauthorizedException(
          'La cuenta vinculada de Comercia no está habilitada',
        );
      }
      return existente.usuario.id;
    }

    const candidatos = await this.prisma.usuario.findMany({
      where: {
        correo: { equals: identidad.correo, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true },
      take: 2,
    });
    if (candidatos.length !== 1) {
      throw new UnauthorizedException(
        'No hay una cuenta única y activa de Comercia para este correo',
      );
    }

    try {
      await this.prisma.identidadUcheck.create({
        data: {
          usuarioId: candidatos[0].id,
          ucheckUsuarioId: identidad.usuarioId,
          correoVinculado: identidad.correo,
        },
      });
      return candidatos[0].id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const vinculo = await this.prisma.identidadUcheck.findUnique({
          where: { ucheckUsuarioId: identidad.usuarioId },
          select: { usuarioId: true },
        });
        if (vinculo?.usuarioId === candidatos[0].id) return vinculo.usuarioId;
        throw new UnauthorizedException(
          'La cuenta ya está vinculada a otra identidad',
        );
      }
      throw error;
    }
  }
}
