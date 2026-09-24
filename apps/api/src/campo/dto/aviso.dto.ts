import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FrecuenciaAvisoCampo,
  TipoAvisoCampo,
} from '../../../generated/prisma/client';
import { PaginacionDto } from '../../common/utils/paginacion';

export class ConsultaAvisosDto extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  buscar?: string;
}

export class CrearAvisoDto {
  @IsEnum(TipoAvisoCampo)
  tipo!: TipoAvisoCampo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinatarioId?: number;

  @IsOptional()
  @IsString()
  destinatariosIds?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  mensaje!: string;

  @IsOptional()
  @IsEnum(FrecuenciaAvisoCampo)
  frecuencia?: FrecuenciaAvisoCampo;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaInicio?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  hora?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  intervaloHoras?: number;

  @IsOptional()
  @IsString()
  diasSemana?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diaMes?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaFin?: string;
}
