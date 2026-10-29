import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ConsultaCampoDto } from './campo.dto';

/** Locales de Administración: con lat/lng se ordenan por cercanía. */
export class ConsultaLocalesCampoDto extends ConsultaCampoDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
