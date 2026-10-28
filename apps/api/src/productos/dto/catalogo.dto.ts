import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsEmpty,
  Max,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import {
  ConsultaSociosDto,
  EmpresaSociosParams,
} from '../../socios-negocio/dto/consulta-socios.dto';
import { ResumenLoteDto } from '../../common/dto/resumen-lote.dto';
import { CampoTabla } from '../utils/campo-catalogo';
export class ConsultaCatalogoDto extends ConsultaSociosDto {
  @ApiPropertyOptional({
    example: 'A0001',
    description: 'Código exacto del artículo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemcode?: string;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    example: 1,
    description: 'Código int4 de lista.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  pricelist?: number;
}
export class EmpresaCatalogoParams extends EmpresaSociosParams {}
export class ProductoCatalogoParams extends EmpresaSociosParams {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 15,
    example: 'A0001',
    description: 'ItemCode original exacto en esta empresa, nunca id técnico.',
  })
  @IsString()
  @MaxLength(15)
  @MinLength(1)
  ItemCode!: string;
  @ApiProperty({
    type: 'integer',
    minimum: -2147483648,
    maximum: 2147483647,
    example: 1,
    description: 'PriceList original; completa la clave del precio.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  PriceList!: number;
}
// Adaptador de la pantalla existente. Las cargas nuevas usan tbl_oitm/tbl_itm1.
export class DatosProductoDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 15,
    requerido: true,
    descripcion: 'ItemCode del maestro tbl_oitm. Máximo 15 caracteres.',
    ejemplo: 'A0001',
  })
  itemcode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    nullable: true,
    descripcion: 'ItemName del maestro; compartido entre todas las listas.',
    ejemplo: 'Artículo',
  })
  itemname?: string | null;
  @CampoTabla({
    tipo: 'entero',
    small: true,
    nullable: true,
    descripcion: 'TaxCodeAR del maestro.',
    ejemplo: 10,
  })
  iva?: number | null;
  @CampoTabla({
    tipo: 'entero',
    small: true,
    nullable: true,
    defecto: -1,
    descripcion: 'ItmsGrpCod int2 del maestro.',
    ejemplo: 100,
  })
  itmsgrpcode?: number | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    deprecated: true,
    description:
      'Retirado del esquema: solo admite null o vacío. El nombre del grupo no forma parte del nuevo maestro.',
  })
  @IsOptional()
  @IsEmpty()
  itmsgrpnam?: string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 1,
    nullable: true,
    defecto: 'N',
    descripcion: 'QryInventario del maestro.',
    ejemplo: 'N',
  })
  inventory?: string | null;
  @CampoTabla({
    tipo: 'entero',
    requerido: true,
    descripcion:
      'PriceList int4; junto a ItemCode identifica el precio en la empresa.',
    ejemplo: 1,
  })
  pricelist!: number;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    nullable: true,
    descripcion:
      'Nombre de lista. Se guarda en tbl_opln.ListName y se comparte entre todos los artículos de la lista.',
    ejemplo: 'General',
  })
  pricelistname?: string | null;
  @CampoTabla({
    tipo: 'decimal',
    nullable: true,
    descripcion: 'Price de tbl_itm1.',
    ejemplo: '15000.123456',
  })
  price?: number | string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    nullable: true,
    descripcion:
      'U_beas_vg del maestro, expuesto como tipo por este adaptador.',
    ejemplo: 'Artículo',
  })
  tipo?: string | null;
}
export class CrearProductoDto extends DatosProductoDto {}
export class ProductoRespuestaDto {
  @ApiProperty({
    type: String,
    example: '1',
    readOnly: true,
    description:
      'ID técnico interno de tbl_itm1, solo informativo. Las rutas usan ItemCode y PriceList.',
  })
  id!: string;
  @ApiProperty({ type: String, example: 'A0001' }) itemcode!: string;
  @ApiProperty({ type: String, nullable: true }) itemname!: string | null;
  @ApiProperty({ type: 'integer', nullable: true }) iva!: number | null;
  @ApiProperty({ type: 'integer', nullable: true }) itmsgrpcode!: number | null;
  @ApiProperty({
    type: String,
    nullable: true,
    deprecated: true,
    description: 'Campo retirado; siempre null.',
  })
  itmsgrpnam!: string | null;
  @ApiProperty({ type: String, nullable: true }) inventory!: string | null;
  @ApiProperty({ type: 'integer' }) pricelist!: number;
  @ApiProperty({ type: String, nullable: true }) pricelistname!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '15000.123456' })
  price!: string | null;
  @ApiProperty({ type: String, nullable: true }) tipo!: string | null;
}
export class PaginaProductoDto {
  @ApiProperty({ type: [ProductoRespuestaDto] }) items!: ProductoRespuestaDto[];
  @ApiProperty({ type: 'integer' }) total!: number;
  @ApiProperty({ type: 'integer' }) page!: number;
  @ApiProperty({ type: 'integer' }) limit!: number;
  @ApiProperty({ type: 'integer' }) totalPages!: number;
}
export class LoteProductosRespuestaDto extends ResumenLoteDto {}
