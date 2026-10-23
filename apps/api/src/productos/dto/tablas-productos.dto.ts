import { CampoTabla } from '../utils/campo-catalogo';
export class ArticuloDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 15,
    requerido: true,
    nullable: false,
    descripcion: 'Código único del artículo dentro de la empresa.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: false,
    nullable: true,
    descripcion: 'Nombre del artículo compartido por sus listas.',
    ejemplo: 'Artículo de ejemplo',
  })
  ItemName?: string | null;
  @CampoTabla({
    tipo: 'entero',
    small: true,
    requerido: false,
    nullable: true,
    descripcion: 'Código impositivo int2.',
    ejemplo: 10,
  })
  TaxCodeAR?: number | null;
  @CampoTabla({
    tipo: 'entero',
    small: true,
    requerido: false,
    nullable: true,
    defecto: -1,
    descripcion: 'Grupo de artículos int2.',
    ejemplo: 100,
  })
  ItmsGrpCod?: number | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 1,
    requerido: false,
    nullable: true,
    defecto: 'N',
    descripcion: 'Indicador de inventario original.',
    ejemplo: 'Y',
  })
  QryInventario?: string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Peso de venta (SAP SWeight1), numeric(21,6).',
    ejemplo: '1.250000',
  })
  SWeight1?: number | string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 10,
    requerido: false,
    nullable: true,
    descripcion: 'Almacén por defecto (SAP DfltWH).',
    ejemplo: '01',
  })
  DfltWH?: string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 1,
    requerido: false,
    nullable: true,
    defecto: 'Y',
    descripcion: 'Indicador de artículo activo.',
    ejemplo: 'Y',
  })
  validFor?: string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 1,
    requerido: false,
    nullable: true,
    defecto: 'N',
    descripcion: 'Indicador de artículo bloqueado.',
    ejemplo: 'N',
  })
  frozenFor?: string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Cantidad por unidad del artículo (SAP U_ItemQty), numeric(21,6).',
    ejemplo: '12.000000',
  })
  U_ItemQty?: number | string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: false,
    nullable: true,
    descripcion: 'Tipo del artículo.',
    ejemplo: 'Artículo',
  })
  TIPO?: string | null;
}
export class PrecioListaDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Artículo existente en tbl_oitm de la misma empresa.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion: 'Lista int4; referencia lógica a tbl_opln.ListNum.',
    ejemplo: 1,
  })
  PriceList!: number;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Precio del artículo en la lista.',
    ejemplo: '15000.123456',
  })
  Price?: number | string | null;
}
export class PrecioSocioDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Artículo; referencia lógica a tbl_oitm.ItemCode.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Socio; referencia lógica a tbl_ocrd.CardCode.',
    ejemplo: 'C0001',
  })
  CardCode!: string;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Precio especial.',
    ejemplo: '14000.123456',
  })
  Price?: number | string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 10,
    requerido: false,
    nullable: true,
    descripcion: 'Moneda original hasta diez caracteres.',
    ejemplo: 'PYG',
  })
  Currency?: string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Descuento original, admite negativos.',
    ejemplo: '5.000000',
  })
  Discount?: number | string | null;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion: 'Lista int4; referencia lógica a tbl_opln.ListNum.',
    ejemplo: 1,
  })
  ListNum!: number;
  @CampoTabla({
    tipo: 'texto',
    longitud: 1,
    requerido: false,
    nullable: false,
    defecto: 'Y',
    descripcion: 'Indicador de vigencia original; no admite null.',
    ejemplo: 'Y',
  })
  Valid?: string;
}
export class LineaPrecioSocioDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Artículo del precio especial.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Socio del precio especial.',
    ejemplo: 'C0001',
  })
  CardCode!: string;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion: 'Número int4 de línea con este nombre exacto.',
    ejemplo: 0,
  })
  LINENUM!: number;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Precio de la línea.',
    ejemplo: '13500.123456',
  })
  Price?: number | string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 10,
    requerido: false,
    nullable: true,
    descripcion: 'Moneda original.',
    ejemplo: 'PYG',
  })
  Currency?: string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Descuento de la línea.',
    ejemplo: '7.000000',
  })
  Discount?: number | string | null;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion:
      'Lista; junto a artículo y socio relaciona lógicamente tbl_ospp.',
    ejemplo: 1,
  })
  ListNum!: number;
}
export class PromocionPrecioDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Artículo de la promoción.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion:
      'Socio. Solo una fila por artículo y socio en la empresa, sin lista en la clave.',
    ejemplo: 'C0001',
  })
  CardCode!: string;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: false,
    nullable: true,
    descripcion:
      'Referencia lógica a LINENUM de tbl_spp1; sin ListNum no identifica una única lista.',
    ejemplo: 0,
  })
  SPP1Lnum?: number | null;
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: false,
    nullable: true,
    descripcion: 'Número de línea de promoción original.',
    ejemplo: 0,
  })
  SPP2LNum?: number | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Cantidad o importe original.',
    ejemplo: '10.000000',
  })
  Amount?: number | string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Precio promocional.',
    ejemplo: '13000.123456',
  })
  Price?: number | string | null;
  @CampoTabla({
    tipo: 'decimal',
    requerido: false,
    nullable: true,
    descripcion: 'Descuento promocional.',
    ejemplo: '10.000000',
  })
  Discount?: number | string | null;
}
