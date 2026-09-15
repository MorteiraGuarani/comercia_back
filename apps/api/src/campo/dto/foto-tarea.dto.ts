import { IsEnum, IsNotEmpty } from 'class-validator';

/**
 * Enum para momento de la foto (debe coincidir con Prisma)
 */
export enum MomentoFotoDto {
  ANTES = 'ANTES',
  DESPUES = 'DESPUES',
}

/**
 * DTO para subir foto de tarea (usado con multipart/form-data)
 */
export class SubirFotoTareaDto {
  @IsNotEmpty({ message: 'Debe especificar el momento de la foto' })
  @IsEnum(MomentoFotoDto, { message: 'El momento debe ser ANTES o DESPUES' })
  momento: MomentoFotoDto;
}

/**
 * DTO de respuesta para foto de tarea
 */
export interface FotoTareaDto {
  id: number;
  momento: 'ANTES' | 'DESPUES';
  rutaArchivo: string;
  mimeType: string;
  tamanioBytes: number;
  creadoAt: Date;
}

/**
 * DTO de respuesta para fotos antes/después de una tarea
 */
export interface FotosTareaResponseDto {
  antes?: FotoTareaDto;
  despues?: FotoTareaDto;
}
