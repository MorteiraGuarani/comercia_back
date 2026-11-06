import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';
import { vacioComo } from '../../common/utils/transforms';

/** Conexión a SAP de la empresa. Vacío borra esquema/usuario; la contraseña vacía se conserva. */
class DatosSapEmpresaDto {
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sapEsquema?: string | null;

  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sapUsuario?: string | null;

  // Sin recortar: los espacios pueden ser parte de la contraseña.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sapContrasenia?: string;
}

export class CrearEmpresaAdminDto extends DatosSapEmpresaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dbName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId?: number | null;

  /** Días antes del vencimiento en que avisa el inventario de los locales. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  diasAvisoVencimiento?: number;
}

export class ActualizarEmpresaAdminDto extends DatosSapEmpresaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dbName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId?: number | null;

  /** Días antes del vencimiento en que avisa el inventario de los locales. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  diasAvisoVencimiento?: number;
}
