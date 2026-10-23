import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_PINGS_POR_LOTE } from '../ubicaciones.constants';

export class PingUbicacionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud!: number;

  /** Radio de error informado por el navegador, en metros. */
  @IsNumber()
  @Min(0)
  @Max(100_000)
  precisionMetros!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(150)
  velocidadMps?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  rumboGrados?: number | null;

  /** Momento en que el equipo tomó la posición (ISO 8601). */
  @IsISO8601({ strict: true })
  capturadaEn!: string;
}

export class LotePingsDto {
  // El plugin de Swagger no traduce ArrayMaxSize.
  @ApiProperty({
    type: [PingUbicacionDto],
    minItems: 1,
    maxItems: MAX_PINGS_POR_LOTE,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PINGS_POR_LOTE)
  @ValidateNested({ each: true })
  @Type(() => PingUbicacionDto)
  pings!: PingUbicacionDto[];
}

export class ConsultaUbicacionesDto {
  /** Solo superadmin: empresa a mostrar; por defecto, la propia. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  empresaId?: number;
}

export class ConsultaRecorridoDto extends ConsultaUbicacionesDto {
  /** Día de campo (YYYY-MM-DD); por defecto, hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: false })
  fecha?: string;
}
