import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import { IDS_LINEAS_PEDIDO, type LineaPedido } from '../utils/lineas-pedido';

export class BuscarClientesPedidoDto extends PaginacionDto {
  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
}

export class BuscarProductosPedidoDto extends PaginacionDto {
  /** Cliente de tbl_ocrd: define la lista de precios. */
  @IsString() @Length(1, 50) cardCode!: string;

  @IsIn(IDS_LINEAS_PEDIDO, { message: 'Línea de productos inválida' })
  linea!: LineaPedido;

  @IsOptional() @IsString() @MaxLength(120) buscar?: string;
}

export class LineaPedidoDto {
  @IsString() @Length(1, 100) itemCode!: string;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1)
  @Max(9999)
  cantidad!: number;
}

export class CrearPedidoDto {
  @IsString() @Length(1, 50) cardCode!: string;

  /** Día de entrega (AAAA-MM-DD), desde mañana. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La entrega debe tener el formato AAAA-MM-DD',
  })
  fechaEntrega!: string;

  @IsOptional() @IsString() @MaxLength(500) observaciones?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoDto)
  lineas!: LineaPedidoDto[];

  /** Generado en el dispositivo: reintentar la sincronización no duplica el pedido. */
  @IsOptional() @IsUUID() operacionId?: string;
}

export class LineaDocumentoDto {
  @IsString() @Length(1, 100) ItemCode!: string;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1)
  @Max(9999)
  Quantity!: number;
}

export class EditarDocumentoDto {
  /** Día de entrega (AAAA-MM-DD), desde mañana. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La entrega debe tener el formato AAAA-MM-DD',
  })
  DocDueDate!: string;

  @IsString() @MaxLength(254) Comments!: string;

  /** Solo cantidades de sus productos: la que no venga se quita del documento. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Dejá al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaDocumentoDto)
  lineas!: LineaDocumentoDto[];
}
