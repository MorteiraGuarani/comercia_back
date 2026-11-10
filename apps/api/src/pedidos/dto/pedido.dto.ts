import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
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

  /** Va en Comments después de «Migrado por Comercia…»; SAP admite 254 en total. */
  @IsOptional() @IsString() @MaxLength(200) observaciones?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoDto)
  lineas!: LineaPedidoDto[];

  /** Generado en el dispositivo: reintentar la sincronización no duplica el pedido. */
  @IsOptional() @IsUUID() operacionId?: string;

  /** Además de guardarlo, lo envía a SAP. */
  @IsOptional() @IsBoolean() enviarSap?: boolean;
}

export class LineaCopiaPedidoDto {
  @IsString() @Length(1, 100) itemCode!: string;

  /** Sin exigir entero: las facturas de SAP pueden traer decimales. */
  @Type(() => Number) @IsNumber() @Min(0) @Max(1_000_000) cantidad!: number;
}

export class CopiarPedidoDto {
  @IsString() @Length(1, 50) cardCode!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'El pedido a copiar no tiene productos' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaCopiaPedidoDto)
  lineas!: LineaCopiaPedidoDto[];
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

  /** Solo lo que escribe el usuario: «Migrado por Comercia…» lo mantiene la API. */
  @IsString() @MaxLength(200) Comments!: string;

  /** Solo cantidades de sus productos: la que no venga se quita del documento. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Dejá al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LineaDocumentoDto)
  lineas!: LineaDocumentoDto[];
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class ConsultaPedidosDto extends PaginacionDto {
  /** Días de carga (AAAA-MM-DD, hora de Asunción). */
  @IsOptional() @Matches(DIA) desde?: string;
  @IsOptional() @Matches(DIA) hasta?: string;
  @IsOptional()
  @IsIn(['CARGADO', 'MIGRADO', 'FACTURADO', 'ENTREGADO'])
  estado?: 'CARGADO' | 'MIGRADO' | 'FACTURADO' | 'ENTREGADO';
}
