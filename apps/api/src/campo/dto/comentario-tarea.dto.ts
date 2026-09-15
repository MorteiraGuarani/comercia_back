import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO para crear un comentario en una tarea completada
 */
export class CrearComentarioTareaDto {
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @IsString()
  @MaxLength(500, { message: 'El comentario no puede superar 500 caracteres' })
  comentario: string;
}

/**
 * DTO de respuesta para comentario de tarea
 */
export interface ComentarioTareaDto {
  id: number;
  comentario: string;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
  };
  creadoAt: Date;
  leidoPorLider: boolean;
  leidoAt?: Date;
}
