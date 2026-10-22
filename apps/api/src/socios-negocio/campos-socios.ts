/** Descripciones y ejemplos comunes; los DTO conservan las restricciones por tabla. */
export const CAMPOS_SOCIOS = {
  CardCode: {
    description:
      'Código original del socio. Relaciona tbl_ocrd con tbl_crd1 dentro de la misma empresa.',
    example: 'C0001',
  },
  CardName: {
    description: 'Nombre o razón social del socio de negocio.',
    example: 'Comercial del Centro',
  },
  AliasName: {
    description:
      'Alias o nombre de fantasía del socio (texto libre, hasta 2000 caracteres).',
    example: 'Comercial del Centro S.A.',
  },
  CardType: {
    description:
      'Tipo de socio de SAP (C cliente, S proveedor, L oportunidad). Por defecto C.',
    example: 'C',
  },
  Currency: {
    description: 'Moneda del socio, código de SAP.',
    example: 'GS',
  },
  Phone1: {
    description: 'Teléfono principal. Desde PDV y rutas se guarda en E.164.',
    example: '+595991188620',
  },
  Cellular: {
    description: 'Celular del socio, conservado como texto.',
    example: '+595981000000',
  },
  E_Mail: {
    description: 'Correo electrónico del socio, conservado como texto.',
    example: 'compras@ejemplo.com.py',
  },
  validFor: {
    description: 'Activo en SAP (Y/N). Por defecto Y.',
    example: 'Y',
  },
  frozenFor: {
    description: 'Bloqueado en SAP (Y/N). Por defecto N.',
    example: 'N',
  },
  GlblLocNum: {
    description: 'Número de ubicación global (GLN) del socio.',
    example: '7840000000001',
  },
  U_SubCanal: {
    description: 'Subcanal propio de SAP, conservado como texto.',
    example: '1',
  },
  U_Repositor: {
    description: 'Repositor asignado en SAP, conservado como texto.',
    example: 'REP01',
  },
  GroupCode: {
    description:
      'Código de grupo de clientes; referencia lógica a tbl_ocrg.GroupCode de la empresa.',
    example: 1,
  },
  GroupNum: {
    description:
      'Código de condición de pago; referencia lógica a tbl_octg.GroupNum de la empresa. En tbl_ocrd se usa -1 si se omite.',
    example: 1,
  },
  LicTradNum: {
    description: 'Identificación tributaria del socio, conservada como texto.',
    example: '80012345-6',
  },
  ListNum: {
    description:
      'Código de lista de precios; referencia lógica a tbl_opln.ListNum de la empresa.',
    example: 1,
  },
  SlpCode: {
    description:
      'Código del vendedor; referencia lógica a tbl_oslp.SlpCode de la empresa. En tbl_ocrd se usa -1 si se omite.',
    example: 1,
  },
  QryLunes: {
    description:
      'Indicador original de atención o visita del lunes. Se admite un carácter y se conserva el valor enviado.',
    example: 'Y',
  },
  QryMartes: {
    description:
      'Indicador original de atención o visita del martes. Se admite un carácter y se conserva el valor enviado.',
    example: 'N',
  },
  QryMiercoles: {
    description:
      'Indicador original de atención o visita del miércoles. Se admite un carácter y se conserva el valor enviado.',
    example: 'N',
  },
  QryJueves: {
    description:
      'Indicador original de atención o visita del jueves. Se admite un carácter y se conserva el valor enviado.',
    example: 'N',
  },
  QryViernes: {
    description:
      'Indicador original de atención o visita del viernes. Se admite un carácter y se conserva el valor enviado.',
    example: 'Y',
  },
  AgentCode: {
    description:
      'Código del supervisor; referencia lógica a tbl_oagp.AgentCode de la empresa.',
    example: 'SUP01',
  },
  U_Latitud: {
    description:
      'Latitud original como texto, sin conversión a número ni validación geográfica adicional.',
    example: '-25.2867',
  },
  U_Longitud: {
    description:
      'Longitud original como texto, sin conversión a número ni validación geográfica adicional.',
    example: '-57.6470',
  },
  U_jCANAL: {
    description:
      'Valor original como texto. Si representa un entero int4, se resuelve contra tbl_jcanales.Code de la empresa; por ejemplo, "001" referencia Code=1.',
    example: '1',
  },
  U_jSUBCANAL: {
    description:
      'Valor original como texto. Si representa un entero int4, se resuelve contra tbl_jsubcanales.Code de la empresa.',
    example: '1',
  },
  Address: {
    description: 'Nombre o identificación de la dirección del socio.',
    example: 'Casa central',
  },
  Street: {
    description: 'Calle y dirección original del socio.',
    example: 'Av. Mariscal López 123',
  },
  AdresType: {
    description:
      'Tipo original de dirección. Predeterminado S; se conserva el texto recibido sin imponer un catálogo adicional.',
    example: 'S',
  },
  Code: {
    description:
      'Código original del catálogo. Al crear puede enviarse o asignarse automáticamente por empresa; al editar, omitirlo conserva el actual. Las rutas de canales y subcanales usan Code, nunca id técnico.',
    example: 1,
  },
  Name: {
    description: 'Nombre del canal o subcanal de este catálogo.',
    example: 'Mayorista',
  },
  AgentName: { description: 'Nombre del supervisor.', example: 'Ana Pérez' },
  SlpName: { description: 'Nombre del vendedor.', example: 'Luis Gómez' },
  Memo: {
    description: 'Observaciones de SAP, conservadas como texto.',
    example: 'Zona centro',
  },
  Active: {
    description: 'Vendedor activo en SAP (Y/N). Por defecto Y.',
    example: 'Y',
  },
  Fax: { description: 'Fax del vendedor, conservado como texto.', example: '021000000' },
  GroupName: {
    description: 'Nombre del grupo de clientes.',
    example: 'Minoristas',
  },
  PymntGroup: {
    description: 'Nombre de la condición de pago.',
    example: 'Crédito a 30 días',
  },
  ListName: {
    description: 'Nombre de la lista de precios.',
    example: 'Lista general',
  },
} as const;
