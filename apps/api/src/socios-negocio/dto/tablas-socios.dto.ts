import {
  TextoSocio,
  EnteroSocio,
  CodigoIdentidadSocio,
  BanderaSocio,
} from '../utils/campos-dto';

export class SocioNegocioDto {
  @TextoSocio(50, false, undefined)
  CardCode!: string;
  @TextoSocio(250, true, undefined)
  CardName?: string | null;
  @TextoSocio(250, true, undefined)
  CardFName?: string | null;
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
  @TextoSocio(200, true, undefined)
  AgentCode?: string | null;
  @TextoSocio(200, true, undefined)
  AgentName?: string | null;
}

export class SocioNegocioVendedorDto {
  @EnteroSocio('int4', undefined)
  SlpCode?: number | null;
  @TextoSocio(200, true, undefined)
  SlpName?: string | null;
}

export class SocioNegocioGrupoDto {
  @EnteroSocio('int4', undefined)
  GroupCode?: number | null;
  @TextoSocio(200, true, undefined)
  GroupName?: string | null;
}

export class SocioNegocioCondicionPagoDto {
  @EnteroSocio('int4', undefined)
  GroupNum?: number | null;
  @TextoSocio(200, true, undefined)
  PymntGroup?: string | null;
}

export class SocioNegocioListaPrecioDto {
  @EnteroSocio('int4', undefined)
  ListNum?: number | null;
  @TextoSocio(200, true, undefined)
  ListName?: string | null;
}
