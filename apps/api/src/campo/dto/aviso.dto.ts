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
import { TipoAvisoCampo } from '../../../generated/prisma/client';

export class CrearAvisoDto {
  @IsEnum(TipoAvisoCampo)
  tipo!: TipoAvisoCampo;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  destinatarioId?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  mensaje!: string;
}
