import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';
import { MAX_INT4 } from '../../common/utils/numeros';
import { lowerTrimString, trimString } from '../../common/utils/transforms';

// Texto libre opcional: vacío se guarda como null.
const textoOpcional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
import { PaginacionDto } from '../../common/utils/paginacion';

export class ListarUsuariosDto extends PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  buscar?: string;
}

export class AsignarUsuarioLocalDto {
  /** CardCode del socio de negocio (tbl_ocrd). */
  @IsString()
  @Length(1, 50)
  localId!: string;

  @IsDateString({ strict: false })
  fechaDesde!: string;

  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @IsOptional()
  @IsDateString({ strict: false })
  fechaHasta?: string | null;
}

export class CrearUsuarioDto extends RegisterDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  rolId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  superiorId?: number | null;

  @IsOptional()
  @IsBoolean()
  esSuperadmin?: boolean;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  legajo?: string | null;
}

export class ActualizarUsuarioDto {
  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @Transform(lowerTrimString)
  @IsEmail({}, { message: 'el correo no tiene un formato válido' })
  @MaxLength(120)
  correo?: string;

  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString()
  @Transform(trimString)
  @Length(2, 60)
  nombre?: string;

  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString()
  @Transform(trimString)
  @Length(2, 60)
  apellido?: string;

  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString()
  @Transform(lowerTrimString)
  @Matches(/^[a-z0-9][a-z0-9._-]{2,29}$/, {
    message:
      'el nombre de usuario debe tener 3 a 30 caracteres (letras, números, ".", "-", "_") y empezar con letra o número',
  })
  nombreLogin?: string;

  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString()
  @Transform(trimString)
  @Length(3, 20)
  ruc?: string;

  // Obligatorio al cambiar RUC o celular: define cómo se validan.
  @ValidateIf(
    (o: ActualizarUsuarioDto) =>
      o.celularPais !== undefined || o.ruc !== undefined || o.celular !== undefined,
  )
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'celularPais debe ser un código de país de 2 letras',
  })
  celularPais?: string;

  @ValidateIf((_objeto, valor: unknown) => valor !== undefined)
  @IsString()
  @Transform(trimString)
  @Length(4, 25)
  celular?: string;

  @Transform(textoOpcional)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  legajo?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  rolId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  superiorId?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;
}
