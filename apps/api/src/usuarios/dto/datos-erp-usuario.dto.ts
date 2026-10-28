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
    example: 'MAYORISTA',
    description: 'Canal de venta en el ERP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ERP_CanalVenta?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 8,
    example: 'ALM01',
    description: 'Código de almacén en el ERP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(8)
  ERP_Almacen?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 30,
    example: 'SUP01',
    description:
      'Referencia del supervisor en el ERP; no modifica el superior inmediato de Comercia.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ERP_Supervisor?: string | null;

  @ApiPropertyOptional({
    type: 'integer',
    format: 'int32',
    nullable: true,
    minimum: MIN_INT4,
    maximum: MAX_INT4,
    example: 27,
    description: 'Código entero del vendedor en el ERP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsInt()
  @Min(MIN_INT4)
  @Max(MAX_INT4)
  ERP_Vendedor?: number | null;

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
    maxLength: 50,
    example: 'IMP01',
    description: 'Referencia del impulsador en el ERP.',
  })
  @Transform(vacioComo(null))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ERP_Impulsador?: string | null;
}
