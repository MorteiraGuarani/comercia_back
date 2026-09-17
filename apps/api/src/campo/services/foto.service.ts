import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FotoTareaDto,
  FotosTareaResponseDto,
  MomentoFotoDto,
} from '../dto/foto-tarea.dto';
import { verificarAccesoCumplimiento } from '../utils/autorizacion';
import { validarArchivoImagen } from '../utils/multer-config';
import { NotificacionService } from './notificacion.service';
import { unlinkSync } from 'fs';
import { prepararEvidencia, tareaParaEvidencia } from '../utils/evidencia-tarea';

@Injectable()
export class FotoService {
  constructor(
    private prisma: PrismaService,
    private notificacionService: NotificacionService,
  ) {}

  /**
   * Subir foto antes/después de una tarea
   */
  async subir(
    usuarioId: number,
    empresaId: number,
    visitaId: number,
    tareaId: number,
    momento: MomentoFotoDto,
    file: Express.Multer.File,
  ): Promise<FotoTareaDto> {
    // Validar archivo
    validarArchivoImagen(file);

    const tarea = await tareaParaEvidencia(this.prisma, usuarioId, empresaId, visitaId, tareaId);
    if (!tarea.requiereFotos) {
      throw new BadRequestException('Esta tarea no admite fotos');
    }
    // Crear un borrador para las evidencias, sin contabilizar una tarea cumplida.
    await prepararEvidencia(this.prisma, visitaId, tareaId, tarea.nombre);

    // Verificar si ya existe una foto para este momento
    const fotoExistente = await this.prisma.fotoTareaCampo.findUnique({
      where: {
        cumplimientoVisitaId_cumplimientoTareaId_momento: {
          cumplimientoVisitaId: visitaId,
          cumplimientoTareaId: tareaId,
          momento: momento,
        },
      },
    });

    if (fotoExistente) {
      // Actualizar registro con nueva foto
      const fotoActualizada = await this.prisma.fotoTareaCampo.update({
        where: { id: fotoExistente.id },
        data: {
          rutaArchivo: file.path,
          mimeType: file.mimetype,
          tamanioBytes: file.size,
          creadoAt: new Date(),
        },
        select: {
          id: true,
          momento: true,
          rutaArchivo: true,
          mimeType: true,
          tamanioBytes: true,
          creadoAt: true,
        },
      });

      // Eliminar archivo anterior del disco
      try {
        unlinkSync(fotoExistente.rutaArchivo);
      } catch (error) {
        // Si falla la eliminación, continuar (archivo puede no existir)
        console.error('Error al eliminar foto anterior:', error);
      }

      return {
        id: fotoActualizada.id,
        momento: fotoActualizada.momento,
        rutaArchivo: fotoActualizada.rutaArchivo,
        mimeType: fotoActualizada.mimeType,
        tamanioBytes: fotoActualizada.tamanioBytes,
        creadoAt: fotoActualizada.creadoAt,
      };
    }

    // Crear nueva foto
    const foto = await this.prisma.fotoTareaCampo.create({
      data: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
        usuarioId,
        momento: momento,
        rutaArchivo: file.path,
        mimeType: file.mimetype,
        tamanioBytes: file.size,
      },
      select: {
        id: true,
        momento: true,
        rutaArchivo: true,
        mimeType: true,
        tamanioBytes: true,
        creadoAt: true,
      },
    });

    // Opcional: Crear notificación para el líder
    // await this.notificacionService.crearNotificacionFoto(
    //   empresaId,
    //   usuarioId,
    //   foto.id,
    //   cumplimiento.nombreTarea,
    //   momento,
    // );

    return {
      id: foto.id,
      momento: foto.momento,
      rutaArchivo: foto.rutaArchivo,
      mimeType: foto.mimeType,
      tamanioBytes: foto.tamanioBytes,
      creadoAt: foto.creadoAt,
    };
  }

  /**
   * Obtener fotos de una tarea completada
   */
  async obtener(
    usuarioId: number,
    visitaId: number,
    tareaId: number,
  ): Promise<FotosTareaResponseDto> {
    // Verificar acceso (debe ser dueño o líder)
    await verificarAccesoCumplimiento(
      this.prisma,
      usuarioId,
      visitaId,
      tareaId,
    );

    const fotos = await this.prisma.fotoTareaCampo.findMany({
      where: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
      },
      select: {
        id: true,
        momento: true,
        rutaArchivo: true,
        mimeType: true,
        tamanioBytes: true,
        creadoAt: true,
      },
      take: 2,
    });

    const resultado: FotosTareaResponseDto = {};

    for (const foto of fotos) {
      const fotoDto: FotoTareaDto = {
        id: foto.id,
        momento: foto.momento,
        rutaArchivo: foto.rutaArchivo,
        mimeType: foto.mimeType,
        tamanioBytes: foto.tamanioBytes,
        creadoAt: foto.creadoAt,
      };

      if (foto.momento === 'ANTES') {
        resultado.antes = fotoDto;
      } else {
        resultado.despues = fotoDto;
      }
    }

    return resultado;
  }

  /**
   * Obtener foto por ID (para servir el archivo)
   */
  async obtenerPorId(usuarioId: number, empresaId: number, fotoId: number): Promise<FotoTareaDto | null> {
    const foto = await this.prisma.fotoTareaCampo.findFirst({
      where: { id: fotoId, usuario: { empresaId } },
      select: {
        id: true,
        cumplimientoVisitaId: true,
        cumplimientoTareaId: true,
        momento: true,
        rutaArchivo: true,
        mimeType: true,
        tamanioBytes: true,
        creadoAt: true,
      },
    });

    if (!foto) {
      return null;
    }

    await verificarAccesoCumplimiento(this.prisma, usuarioId, foto.cumplimientoVisitaId, foto.cumplimientoTareaId);

    return {
      id: foto.id,
      momento: foto.momento,
      rutaArchivo: foto.rutaArchivo,
      mimeType: foto.mimeType,
      tamanioBytes: foto.tamanioBytes,
      creadoAt: foto.creadoAt,
    };
  }

  /**
   * Eliminar foto antes/después
   */
  async eliminar(
    usuarioId: number,
    visitaId: number,
    tareaId: number,
    momento: MomentoFotoDto,
  ): Promise<void> {
    // Verificar que el cumplimiento existe y pertenece al usuario
    const cumplimiento = await this.prisma.cumplimientoCampo.findUnique({
      where: {
        visitaId_tareaId: {
          visitaId,
          tareaId,
        },
      },
      select: {
        visita: {
          select: {
            usuarioId: true,
          },
        },
        tarea: {
          select: {
            fotosObligatorias: true,
          },
        },
      },
    });

    if (!cumplimiento) {
      throw new NotFoundException('Tarea no completada');
    }

    if (cumplimiento.visita.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo puedes eliminar fotos de tus propias tareas',
      );
    }

    // Si las fotos son obligatorias, no permitir eliminar después de completar
    if (cumplimiento.tarea.fotosObligatorias) {
      throw new BadRequestException(
        'No puedes eliminar fotos obligatorias de una tarea ya completada',
      );
    }

    // Buscar y eliminar la foto
    const foto = await this.prisma.fotoTareaCampo.findUnique({
      where: {
        cumplimientoVisitaId_cumplimientoTareaId_momento: {
          cumplimientoVisitaId: visitaId,
          cumplimientoTareaId: tareaId,
          momento: momento,
        },
      },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    // Eliminar archivo del disco
    try {
      unlinkSync(foto.rutaArchivo);
    } catch (error) {
      console.error('Error al eliminar archivo de foto:', error);
    }

    // Eliminar registro de BD
    await this.prisma.fotoTareaCampo.delete({
      where: { id: foto.id },
    });
  }

  /**
   * Validar que existan ambas fotos si son obligatorias
   */
  async validarFotosObligatorias(
    visitaId: number,
    tareaId: number,
  ): Promise<boolean> {
    const fotos = await this.prisma.fotoTareaCampo.findMany({
      where: {
        cumplimientoVisitaId: visitaId,
        cumplimientoTareaId: tareaId,
      },
      select: {
        momento: true,
      },
    });

    const tieneAntes = fotos.some((f) => f.momento === 'ANTES');
    const tieneDespues = fotos.some((f) => f.momento === 'DESPUES');

    return tieneAntes && tieneDespues;
  }
}
