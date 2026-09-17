import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginacionDto } from '../../common/utils/paginacion';
import {
  EstadoNovedadCampo,
  PrioridadNovedadCampo,
  TipoNovedadCampo,
} from '../../../generated/prisma/client';

export class CrearNovedadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  localId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tareaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  visitaId?: number;

  @IsEnum(TipoNovedadCampo)
  tipo!: TipoNovedadCampo;

  @IsOptional()
  @IsEnum(PrioridadNovedadCampo)
  prioridad?: PrioridadNovedadCampo = PrioridadNovedadCampo.NORMAL;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  titulo!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  descripcion!: string;
}

export class ListarNovedadesDto extends PaginacionDto {
  @IsOptional()
  @IsEnum(EstadoNovedadCampo)
  estado?: EstadoNovedadCampo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  localId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tareaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId?: number;
}

export class ActualizarEstadoNovedadDto {
  @IsEnum(EstadoNovedadCampo)
  estado!: EstadoNovedadCampo;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolucion?: string;
}
