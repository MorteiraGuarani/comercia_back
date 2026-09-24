import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlinkSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdjuntoCampoDto,
  ArchivoAdjuntoCampoDto,
} from '../dto/adjunto-campo.dto';
import { obtenerEquipoCompleto } from '../utils/autorizacion';
import { validarArchivoImagen } from '../utils/multer-config';

const selectAdjunto = {
  id: true,
  nombreOriginal: true,
  mimeType: true,
  tamanioBytes: true,
  creadoAt: true,
} as const;

@Injectable()
export class AdjuntoCampoService {
  constructor(private readonly prisma: PrismaService) {}

  guardarParaNovedad(
    novedadId: number,
    empresaId: number,
    usuarioId: number,
    archivos: Express.Multer.File[],
  ): Promise<AdjuntoCampoDto[]> {
    return this.guardar(empresaId, usuarioId, archivos, { novedadId });
  }

  guardarParaAviso(
    avisoId: number,
    empresaId: number,
    usuarioId: number,
    archivos: Express.Multer.File[],
  ): Promise<AdjuntoCampoDto[]> {
    return this.guardar(empresaId, usuarioId, archivos, { avisoId });
  }

  private async guardar(
    empresaId: number,
    usuarioId: number,
    archivos: Express.Multer.File[],
    origen: { novedadId: number } | { avisoId: number },
  ): Promise<AdjuntoCampoDto[]> {
    if (archivos.length === 0) return [];

    try {
      archivos.forEach(validarArchivoImagen);
      return await this.prisma.$transaction(
        archivos.map((archivo) =>
          this.prisma.adjuntoCampo.create({
            data: {
              empresaId,
              usuarioId,
              ...origen,
              nombreOriginal: archivo.originalname.slice(0, 255),
              rutaArchivo: resolve(archivo.path),
              mimeType: archivo.mimetype,
              tamanioBytes: archivo.size,
            },
            select: selectAdjunto,
          }),
        ),
      );
    } catch (error) {
      this.descartarArchivos(archivos);
      throw error;
    }
  }

  async obtenerArchivo(
    usuarioId: number,
    empresaId: number,
    adjuntoId: number,
  ): Promise<ArchivoAdjuntoCampoDto> {
    const adjunto = await this.prisma.adjuntoCampo.findFirst({
      where: { id: adjuntoId, empresaId },
      select: {
        ...selectAdjunto,
        rutaArchivo: true,
        novedad: { select: { usuarioId: true } },
        aviso: {
          select: {
            emisorId: true,
            tipo: true,
            destinatarioId: true,
            destinatarios: { select: { usuarioId: true } },
          },
        },
      },
    });

    if (!adjunto) {
      throw new NotFoundException('Imagen adjunta no encontrada');
    }

    let permitido = false;
    if (adjunto.novedad) {
      const equipoIds = await obtenerEquipoCompleto(this.prisma, usuarioId);
      permitido = equipoIds.includes(adjunto.novedad.usuarioId);
    } else if (adjunto.aviso) {
      permitido =
        adjunto.aviso.emisorId === usuarioId ||
        adjunto.aviso.destinatarios.some(
          (destinatario) => destinatario.usuarioId === usuarioId,
        );

      if (
        !permitido &&
        adjunto.aviso.destinatarios.length === 0 &&
        adjunto.aviso.tipo === 'INDIVIDUAL'
      ) {
        permitido = adjunto.aviso.destinatarioId === usuarioId;
      }
      if (
        !permitido &&
        adjunto.aviso.destinatarios.length === 0 &&
        adjunto.aviso.tipo === 'EQUIPO'
      ) {
        const usuario = await this.prisma.usuario.findFirst({
          where: { id: usuarioId, empresaId },
          select: { superiorId: true },
        });
        permitido = usuario?.superiorId === adjunto.aviso.emisorId;
      }
    }

    if (!permitido) {
      throw new ForbiddenException('No tienes acceso a esta imagen');
    }

    return {
      id: adjunto.id,
      nombreOriginal: adjunto.nombreOriginal,
      rutaArchivo: adjunto.rutaArchivo,
      mimeType: adjunto.mimeType,
      tamanioBytes: adjunto.tamanioBytes,
      creadoAt: adjunto.creadoAt,
    };
  }

  descartarArchivos(archivos: Express.Multer.File[]): void {
    for (const archivo of archivos) {
      try {
        unlinkSync(archivo.path);
      } catch {
        // El archivo puede haber sido eliminado por una limpieza previa.
      }
    }
  }
}
