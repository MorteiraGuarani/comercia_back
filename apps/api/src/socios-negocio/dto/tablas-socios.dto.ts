import {
  TextoSocio,
  EnteroSocio,
  CodigoIdentidadSocio,
  BanderaSocio,
} from '../utils/campos-dto';
import { CampoTabla } from '../../productos/utils/campo-catalogo';

export class FabricanteArticuloDto {
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: false,
    nullable: true,
    descripcion: 'Código int4 del fabricante; admite null.',
    ejemplo: 1,
  })
  Code?: number | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 250,
    requerido: false,
    nullable: true,
    descripcion: 'Nombre del fabricante.',
    ejemplo: 'Fabricante de ejemplo',
  })
  ManufacturerName?: string | null;
}

export class CodigoArticuloSocioDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 100,
    requerido: true,
    nullable: false,
    descripcion: 'Código original del artículo.',
    ejemplo: 'A0001',
  })
  ItemCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: true,
    nullable: false,
    descripcion: 'Código original del socio.',
    ejemplo: 'C0001',
  })
  CardCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: true,
    nullable: false,
    descripcion: 'Código alternativo del artículo para el socio.',
    ejemplo: 'ALT0001',
  })
  Substitute!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 300,
    requerido: false,
    nullable: true,
    descripcion: 'Descripción original del código alternativo.',
    ejemplo: 'Artículo de ejemplo',
  })
  Descriptio?: string | null;
}

export class GrupoArticuloDto {
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion: 'Código int4 del grupo de artículos.',
    ejemplo: 100,
  })
  Number!: number;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: false,
    nullable: true,
    descripcion: 'Nombre del grupo de artículos.',
    ejemplo: 'Grupo de ejemplo',
  })
  GroupName?: string | null;
}

export class TipoSubcanalDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 50,
    requerido: true,
    nullable: false,
    descripcion: 'Código original de tipo de subcanal como texto.',
    ejemplo: '001',
  })
  Code!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 120,
    requerido: false,
    nullable: true,
    descripcion: 'Descripción del tipo de subcanal.',
    ejemplo: 'Tipo de ejemplo',
  })
  U_Descripcion?: string | null;
}

export class SocioNegocioDto {
  @TextoSocio(50, false, undefined)
  CardCode!: string;
  @TextoSocio(250, true, undefined)
  CardName?: string | null;
  @TextoSocio(2000, true, undefined)
  AliasName?: string | null;
  @TextoSocio(1, true, 'C')
  CardType?: string | null;
  @EnteroSocio('int2', undefined)
  GroupCode?: number | null;
  @EnteroSocio('int2', -1)
  GroupNum?: number | null;
  @TextoSocio(32, true, undefined)
  LicTradNum?: string | null;
  @TextoSocio(4, true, undefined)
  Currency?: string | null;
  @TextoSocio(50, true, undefined)
  Phone1?: string | null;
  @TextoSocio(50, true, undefined)
  Cellular?: string | null;
  @TextoSocio(250, true, undefined)
  E_Mail?: string | null;
  @EnteroSocio('int2', undefined)
  ListNum?: number | null;
  @BanderaSocio('Y')
  validFor?: string;
  @BanderaSocio('N')
  frozenFor?: string;
  @TextoSocio(50, true, undefined)
  GlblLocNum?: string | null;
  @EnteroSocio('int4', -1)
  SlpCode?: number | null;
  @TextoSocio(1, true, 'N')
  QryLunes?: string | null;
  @TextoSocio(1, true, 'N')
  QryMartes?: string | null;
  @TextoSocio(1, true, 'N')
  QryMiercoles?: string | null;
  @TextoSocio(1, true, 'N')
  QryJueves?: string | null;
  @TextoSocio(1, true, 'N')
  QryViernes?: string | null;
  @TextoSocio(32, true, undefined)
  AgentCode?: string | null;
  @TextoSocio(30, true, undefined)
  U_Latitud?: string | null;
  @TextoSocio(30, true, undefined)
  U_Longitud?: string | null;
  @TextoSocio(50, true, undefined)
  U_jCANAL?: string | null;
  @TextoSocio(50, true, undefined)
  U_jSUBCANAL?: string | null;
  @TextoSocio(50, true, undefined)
  U_SubCanal?: string | null;
  @TextoSocio(50, true, undefined)
  U_Repositor?: string | null;
}

export class SocioNegocioDireccionDto {
  @TextoSocio(200, true, undefined)
  CardCode?: string | null;
  @TextoSocio(200, true, undefined)
  Address?: string | null;
  @TextoSocio(200, true, undefined)
  Street?: string | null;
  @TextoSocio(200, true, 'S')
  AdresType?: string | null;
}

export class SocioNegocioCanalesDto {
  @CodigoIdentidadSocio()
  Code?: number;
  @TextoSocio(100, true, undefined)
  Name?: string | null;
}

export class SocioNegocioSubcanalesDto {
  @CodigoIdentidadSocio()
  Code?: number;
  @TextoSocio(100, true, undefined)
  Name?: string | null;
}

export class SocioNegocioSupervisorDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 150,
    requerido: true,
    nullable: false,
    descripcion:
      'Código del supervisor; tbl_ocrd.AgentCode lo referencia dentro de la empresa.',
    ejemplo: 'SUP01',
  })
  AgentCode!: string;
  @CampoTabla({
    tipo: 'texto',
    longitud: 250,
    requerido: false,
    nullable: true,
    descripcion: 'Nombre del supervisor.',
    ejemplo: 'Ana Pérez',
  })
  AgentName?: string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 250,
    requerido: false,
    nullable: true,
    descripcion: 'Observaciones de SAP.',
    ejemplo: 'Zona centro',
  })
  Memo?: string | null;
}

const textoOpcional = (
  longitud: number,
  descripcion: string,
  ejemplo: string,
) =>
  CampoTabla({
    tipo: 'texto',
    longitud,
    requerido: false,
    nullable: true,
    descripcion,
    ejemplo,
  });
const enteroOpcional = (descripcion: string, ejemplo: number) =>
  CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: false,
    nullable: true,
    descripcion,
    ejemplo,
  });

export class SocioNegocioVendedorDto {
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion:
      'Código int4 del vendedor en SAP; tbl_ocrd.SlpCode lo referencia dentro de la empresa.',
    ejemplo: 1,
  })
  SalesEmployeeCode!: number;
  @textoOpcional(150, 'Nombre del vendedor.', 'Luis Gómez')
  SalesEmployeeName?: string | null;
  @textoOpcional(150, 'Observaciones de SAP.', 'Zona centro')
  Remarks?: string | null;
  @enteroOpcional('Comisión del vendedor.', 0)
  CommissionForSalesEmployee?: number | null;
  @enteroOpcional('Grupo de comisiones.', 0)
  CommissionGroup?: number | null;
  @textoOpcional(4, 'Bloqueado en SAP, tal como lo envía SAP.', 'N')
  Locked?: string | null;
  @enteroOpcional('Empleado de SAP asociado.', 1)
  EmployeeID?: number | null;
  @textoOpcional(4, 'Activo en SAP, tal como lo envía SAP.', 'Y')
  Active?: string | null;
  @textoOpcional(100, 'Teléfono del vendedor.', '021000000')
  Telephone?: string | null;
  @textoOpcional(100, 'Celular del vendedor.', '+595981000000')
  Mobile?: string | null;
  @textoOpcional(100, 'Fax del vendedor.', '021000001')
  Fax?: string | null;
  @textoOpcional(200, 'Correo del vendedor.', 'vendedor@ejemplo.com.py')
  Email?: string | null;
}

export class AlmacenDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 100,
    requerido: true,
    nullable: false,
    descripcion: 'Código del almacén en SAP.',
    ejemplo: '01',
  })
  WarehouseCode!: string;
  @textoOpcional(300, 'Nombre del almacén.', 'Depósito central')
  WarehouseName?: string | null;
  @enteroOpcional('Ubicación del almacén en SAP.', 1)
  Location?: number | null;
  @textoOpcional(100, 'Número de ubicación global (GLN).', '7840000000001')
  GlobalLocationNumber?: string | null;
  @textoOpcional(150, 'Dirección 2 del almacén (AddressName2).', 'Ruta 2 km 20')
  AddressName2?: string | null;
}

export class CatalogoOclpDto {
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: true,
    nullable: false,
    descripcion: 'Código int4 de OCLP en SAP.',
    ejemplo: 1,
  })
  Code!: number;
  @textoOpcional(100, 'Nombre.', 'Ejemplo')
  Name?: string | null;
}

export class CatalogoJfdvDto {
  @CampoTabla({
    tipo: 'texto',
    longitud: 20,
    requerido: true,
    nullable: false,
    descripcion: 'Código de JFDV en SAP, como texto.',
    ejemplo: '001',
  })
  Code!: string;
  @textoOpcional(150, 'Nombre.', 'Ejemplo')
  Name?: string | null;
  @textoOpcional(100, 'Campo de usuario U_ESACALA de SAP.', 'A')
  U_ESACALA?: string | null;
  @textoOpcional(100, 'Campo de usuario U_TIPO de SAP.', 'T1')
  U_TIPO?: string | null;
  @textoOpcional(100, 'Campo de usuario U_ACTIVO de SAP.', 'Y')
  U_ACTIVO?: string | null;
}

export class SocioNegocioGrupoDto {
  @CampoTabla({
    tipo: 'entero',
    small: false,
    requerido: false,
    nullable: true,
    descripcion: 'Codigo del grupo de socios en la empresa.',
    ejemplo: 1,
  })
  Code?: number | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: false,
    nullable: true,
    descripcion: 'Nombre del grupo de socios.',
    ejemplo: 'Grupo de ejemplo',
  })
  Name?: string | null;
  @CampoTabla({
    tipo: 'texto',
    longitud: 200,
    requerido: false,
    nullable: true,
    descripcion: 'Tipo del grupo de socios.',
    ejemplo: 'Cliente',
  })
  Type?: string | null;
}

export class SocioNegocioCondicionPagoDto {
  @EnteroSocio('int4', undefined)
  GroupNumber?: number | null;
  @TextoSocio(250, true, undefined)
  PaymentTermsGroupName?: string | null;
  @EnteroSocio('int4', undefined)
  PriceListNo?: number | null;
}

export class SocioNegocioListaPrecioDto {
  @EnteroSocio('int4', undefined)
  ListNum?: number | null;
  @TextoSocio(200, true, undefined)
  ListName?: string | null;
}
