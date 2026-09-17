import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EstadoTareaCampo,
  FrecuenciaCampo,
} from '../../../generated/prisma/client';
import { PaginacionDto } from '../../common/utils/paginacion';
import { MAX_INT4 } from '../../common/utils/numeros';

export class ConsultaCampoDto extends PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  override limit?: number = undefined;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  clienteId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  localId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  usuarioId?: number;
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fecha?: string;
}

export class ClienteCampoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;
  @IsString() @MaxLength(30) ruc = '';
  @IsString() @MaxLength(120) contacto = '';
  @IsString() @MaxLength(40) telefono = '';
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsBoolean() activo = true;
}

export class LocalCampoDto {
  // Datos compartidos con UCHECK.
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_INT4) clienteId!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;
  @IsString() @MaxLength(250) direccion = '';
  @IsString() @MaxLength(120) contacto = '';
  @IsString() @MaxLength(40) telefono = '';
  @IsNumber() @Min(-90) @Max(90) latitud!: number;
  @IsNumber() @Min(-180) @Max(180) longitud!: number;
  @IsInt() @Min(10) @Max(5000) radioMetros = 100;
  @IsString() @MaxLength(80) zonaHoraria = 'America/Asuncion';
  @IsString() @MaxLength(1000) notas = '';
  @IsBoolean() activo = true;
}

export class VigenciaCampoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaDesde!: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaHasta?: string | null;
}

export class HorarioCampoDto extends VigenciaCampoDto {
  @IsEnum(FrecuenciaCampo) frecuencia!: FrecuenciaCampo;
  @IsInt() @Min(1) @Max(52) intervalo = 1;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  diasSemana: number[] = [];
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(31)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  diasMes: number[] = [];
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) entrada!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) salida!: string;
}

export class AsignacionCampoDto extends VigenciaCampoDto {
  @IsInt() @Min(1) @Max(MAX_INT4) usuarioId!: number;
}

export class BackupCampoDto extends AsignacionCampoDto {
  @IsString() @MinLength(2) @MaxLength(250) motivo!: string;
}

export class TareaCampoDto extends VigenciaCampoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;
  @IsString() @MaxLength(1000) descripcion = '';
  @IsBoolean() todosLocales = true;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  localIds: number[] = [];
  @IsBoolean() activo = true;
  @IsBoolean() requiereFotos = false;
  @IsBoolean() fotosObligatorias = false;
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
  @IsOptional() @IsBoolean() esObligatoria?: boolean;
  @IsOptional() @IsEnum(EstadoTareaCampo) estado?: EstadoTareaCampo;
}

export class MarcaCampoDto {
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
  @IsString() @MaxLength(250) nota = '';
}

export class EntradaCampoDto extends MarcaCampoDto {
  @IsInt() @Min(1) @Max(MAX_INT4) asignacionId!: number;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_INT4) horarioId?: number;
}
