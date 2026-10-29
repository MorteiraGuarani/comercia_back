import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ConsultaSociosDto } from '../../socios-negocio/dto/consulta-socios.dto';
export class ConsultaTablasDto extends ConsultaSociosDto {
  @ApiPropertyOptional({
    example: 'A0001',
    maxLength: 100,
    description:
      'Filtrar código exacto de artículo (hasta 100 caracteres en tbl_oitm).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ItemCode?: string;
  @ApiPropertyOptional({
    example: 'C0001',
    description: 'Filtrar código exacto de socio en tablas que lo tienen.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  CardCode?: string;
  @ApiPropertyOptional({
    type: 'integer',
    example: 1,
    description: 'Filtrar lista de tbl_itm1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  PriceList?: number;
  @ApiPropertyOptional({
    type: 'integer',
    example: 1,
    description: 'Filtrar lista de tbl_ospp/tbl_spp1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  ListNum?: number;
}
