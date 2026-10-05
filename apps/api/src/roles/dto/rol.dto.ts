import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';
import { PaginacionDto } from '../../common/utils/paginacion';
import { DestinatarioTareaCampo } from '../../../generated/prisma/client';

export class PlanificacionRolDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  equipoCampoId?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nuevoEquipoNombre?: string;

  @IsOptional()
  @IsIn([DestinatarioTareaCampo.IMPULSADOR, DestinatarioTareaCampo.REPOSITOR])
  nuevoEquipoTipo?: DestinatarioTareaCampo;
}

export class ListarEquiposCampoDto extends PaginacionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId!: number;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  buscar?: string;
}

export class ListarRolesDto extends PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId?: number;
}

export class CrearRolDto extends PlanificacionRolDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  empresaId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descripcion!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  rolId?: number | null;
}

export class ActualizarRolDto extends PlanificacionRolDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT4)
  rolId?: number | null;
}
