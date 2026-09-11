import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoEventoUcheck } from '../../../generated/prisma/client';

export class MarcacionUcheckDto {
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{12,80}$/)
  eventoId!: string;

  @IsEnum(TipoEventoUcheck)
  tipo!: TipoEventoUcheck;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  ucheckJornadaId!: number;

  @IsEmail()
  @MaxLength(254)
  correoUsuario!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  asignacionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  localId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  horarioId?: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  @IsISO8601({ strict: true })
  registradaEn!: string;

  @IsISO8601({ strict: true })
  capturadaEn!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  precisionMetros!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanciaMetros!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centroLatitud!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  centroLongitud!: number;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
  radioMetros!: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaDesde?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaHasta?: string;

  @IsBoolean()
  fueraHorario!: boolean;

  @IsBoolean()
  fueraAtencion!: boolean;

  @IsBoolean()
  ubicacionSimulada!: boolean;

  @IsOptional()
  @IsObject()
  contextoDispositivo?: Record<string, unknown>;
}
