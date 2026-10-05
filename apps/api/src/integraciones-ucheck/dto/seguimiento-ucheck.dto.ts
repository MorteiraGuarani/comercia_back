import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SeguimientoUcheckDto {
  @IsInt() @Min(1) ucheckUsuarioId!: number;
  @IsEmail() @MaxLength(254) correo!: string;
  @IsUUID() jornadaId!: string;
  @IsBoolean() activo!: boolean;
  @IsISO8601({ strict: true }) iniciadaEn!: string;
  @IsISO8601({ strict: true }) reportadaEn!: string;
  @IsOptional() @IsLatitude() latitud?: number | null;
  @IsOptional() @IsLongitude() longitud?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(5000) precisionMetros?: number | null;
  @IsOptional() @IsISO8601({ strict: true }) capturadaEn?: string | null;
}
