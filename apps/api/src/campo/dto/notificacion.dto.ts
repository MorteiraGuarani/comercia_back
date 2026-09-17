import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginacionDto } from '../../common/utils/paginacion';

/**
 * DTO para listar notificaciones (con paginación)
 */
export class ListarNotificacionesDto extends PaginacionDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  leido?: boolean;
}

/**
 * DTO de respuesta para notificación
 */
export interface NotificacionDto {
  id: number;
  tipo:
    | 'COMENTARIO_TAREA'
    | 'TAREA_COMPLETADA'
    | 'FOTO_SUBIDA'
    | 'NOVEDAD_CREADA'
    | 'NOVEDAD_ACTUALIZADA'
    | 'AVISO_RECIBIDO';
  titulo: string;
  mensaje: string;
  usuarioEmisor: {
    id: number;
    nombre: string;
    apellido: string;
  };
  creadoAt: Date;
  leido: boolean;
  leidoAt?: Date;
  referenciaId?: number;
}

/**
 * DTO de respuesta para contador de no leídas
 */
export interface ContadorNoLeidasDto {
  noLeidas: number;
}

/**
 * DTO de respuesta para marcar todas como leídas
 */
export interface MarcarTodasLeidasDto {
  marcadas: number;
}
