import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INT4, MIN_INT4 } from '../../common/utils/numeros';
import { vacioComo } from '../../common/utils/transforms';

/** Omitir conserva el valor en PATCH; null o texto vacío lo borra. */
export class DatosErpUsuarioDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: '1',
    description:
      'Canal de venta: Code de tbl_jcanales de la empresa del usuario (se valida que exista).',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ERP_CanalVenta?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    example: 'REP01',
    description: 'Referencia del repositor en el ERP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ERP_Repositor?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    example: '01',
    description: 'Código del almacén del usuario en SAP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ERP_CodigoAlmacen?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    example: 'DEPÓSITO CENTRAL',
    description: 'Nombre del almacén del usuario en SAP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ERP_NombreAlmacen?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    example: 'manager',
    description: 'Código del usuario en SAP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ERP_CodUsuarioSap?: string | null;

  @ApiPropertyOptional({
    type: 'integer',
    format: 'int32',
    nullable: true,
    minimum: MIN_INT4,
    maximum: MAX_INT4,
    example: 1,
    description:
      'Sucursal: Code de tbl_oclp de la empresa del usuario (se valida que exista).',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsInt()
  @Min(MIN_INT4)
  @Max(MAX_INT4)
  ERP_Sucursal?: number | null;
}
