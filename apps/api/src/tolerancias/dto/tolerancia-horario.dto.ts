import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class ToleranciaHorarioDto {
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 60,
    description:
      'Minutos antes del inicio aceptados en verde. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  anticipoEntrada?: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 14,
    description:
      'Minutos después del inicio en verde. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  toleranciaEntrada?: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 30,
    description:
      'Minutos después del inicio en amarillo; luego rojo. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  limiteEntrada?: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 14,
    description:
      'Minutos antes del fin aceptados en verde. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  toleranciaSalidaAntes?: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 14,
    description:
      'Minutos después del fin en verde. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  toleranciaSalidaDespues?: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1440,
    example: 59,
    description:
      'Minutos después del fin en amarillo; luego rojo. null hereda del nivel anterior; cero es válido.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  limiteSalida?: number | null;
}
