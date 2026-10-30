import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { Prisma } from '../../../generated/prisma/client';
import { esRucParaguayoValido, normalizarRucPy } from '../../common/utils/ruc';
import type { PrismaService } from '../../prisma/prisma.service';
import { ZONA_CAMPO } from './calendario';

/** Rango que admite el ABM para el radio de marcación (U_RadioMetros, 200 por defecto). */
export const RADIO_LOCAL_MIN = 20;
export const RADIO_LOCAL_MAX = 1000;

/** Campos de tbl_ocrd que la operación de campo usa como local. */
export const LOCAL_OCRD_SELECT = {
  CardCode: true,
  CardName: true,
  U_Latitud: true,
  U_Longitud: true,
  U_RadioMetros: true,
} as const;

/** SAP guarda U_Latitud/U_Longitud como texto; admite coma decimal. */
export function coordenadaOcrd(valor: string | null | undefined) {
  const texto = valor?.trim().replace(',', '.');
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export function nombreLocal(l: { CardCode: string; CardName: string | null }) {
  return l.CardName?.trim() || l.CardCode;
}

/** Local abreviado de las respuestas: el id es el CardCode. */
export function localResumen(l: { CardCode: string; CardName: string | null }) {
  return { id: l.CardCode, nombre: nombreLocal(l) };
}

/** Forma de local que consumen la web y UCHECK: el id es el CardCode. */
export function aLocalCampo(
  l: {
    CardCode: string;
    CardName: string | null;
    U_Latitud: string | null;
    U_Longitud: string | null;
    U_RadioMetros: number;
  },
  direccion = '',
) {
  return {
    id: l.CardCode,
    nombre: nombreLocal(l),
    direccion,
    latitud: coordenadaOcrd(l.U_Latitud),
    longitud: coordenadaOcrd(l.U_Longitud),
    radioMetros: l.U_RadioMetros,
    zonaHoraria: ZONA_CAMPO,
  };
}

/** Texto que se guarda en OCRD al marcar el punto en el mapa. */
export function textoCoordenada(valor: number) {
  return valor.toFixed(7);
}

/** Punto del mapa en columnas de OCRD; sin punto, no toca las actuales. */
export function ubicacionOcrd(p: { latitud?: number; longitud?: number }) {
  if (p.latitud === undefined && p.longitud === undefined) return {};
  if (p.latitud === undefined || p.longitud === undefined)
    throw new BadRequestException('Marcá el punto completo en el mapa');
  return {
    U_Latitud: textoCoordenada(p.latitud),
    U_Longitud: textoCoordenada(p.longitud),
  };
}

/** Dirección visible: "Address, Street" de CRD1, omitiendo partes vacías o repetidas. */
export function unirDireccion(address?: string | null, street?: string | null) {
  // SAP suele repetir Address en Street con otros espacios ("X - LIMPIO" / "X -LIMPIO").
  const clave = (texto: string) => texto.replace(/\s+/g, '').toLowerCase();
  return [address, street]
    .map((parte) => parte?.trim())
    .filter((parte, i, partes): parte is string =>
      Boolean(parte) && partes.findIndex((p) => p && clave(p) === clave(parte!)) === i,
    )
    .join(', ');
}

export const CLIENTE_OCRD_SELECT = {
  ...LOCAL_OCRD_SELECT,
  AliasName: true,
  LicTradNum: true,
  Phone1: true,
} as const;

/** RUC paraguayo con dígito verificador correcto; vacío = sin RUC. */
export function rucOcrd(ruc?: string) {
  if (!ruc) return null;
  const normalizado = normalizarRucPy(ruc);
  if (!esRucParaguayoValido(normalizado))
    throw new BadRequestException(
      'El RUC no es válido: revisá el número y su dígito verificador',
    );
  return normalizado;
}

/** Teléfono en E.164; sin "+" se asume Paraguay. Vacío = sin teléfono. */
export function telefonoOcrd(telefono?: string) {
  if (!telefono) return null;
  const numero = parsePhoneNumberFromString(telefono, 'PY');
  if (!numero?.isValid())
    throw new BadRequestException(
      'El teléfono no es válido: revisá el código de país y la cantidad de dígitos',
    );
  return numero.number;
}

/** Cliente del ABM de PDV: el local más RUC y la dirección por partes. */
export function aClientePdv(
  l: Parameters<typeof aLocalCampo>[0] & {
    AliasName: string | null;
    LicTradNum: string | null;
    Phone1: string | null;
  },
  d?: { address: string; street: string },
) {
  return {
    ...aLocalCampo(l, unirDireccion(d?.address, d?.street)),
    alias: l.AliasName?.trim() ?? '',
    ruc: l.LicTradNum ?? '',
    telefono: l.Phone1 ?? '',
    address: d?.address ?? '',
    street: d?.street ?? '',
  };
}

/** Tareas con sus locales en la forma pública ({ id: CardCode, nombre }). */
export function conLocalesTarea<
  T extends {
    locales: { local: { CardCode: string; CardName: string | null } }[];
  },
>(tarea: T) {
  return {
    ...tarea,
    locales: tarea.locales.map((x) => ({ local: localResumen(x.local) })),
  };
}

/** Socios de la empresa, con búsqueda opcional por nombre o CardCode. */
export function filtroLocales(
  empresaId: number,
  buscar?: string,
): Prisma.SocioNegocioWhereInput {
  return {
    empresaId,
    ...(buscar
      ? {
          OR: [
            { CardName: { contains: buscar, mode: 'insensitive' } },
            { AliasName: { contains: buscar, mode: 'insensitive' } },
            { CardCode: { contains: buscar, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

/** Reemplaza la fila de OCRD incluida por el local abreviado público. */
export function conLocalResumen<
  T extends { local: { CardCode: string; CardName: string | null } },
>(fila: T) {
  return { ...fila, local: localResumen(fila.local) };
}

/**
 * Dirección de cada socio desde tbl_crd1 ("Address, Street"), priorizando la
 * de entrega (AdresType S). La relación con OCRD es lógica: no hay FK.
 */
export async function direccionesLocales(
  prisma: Pick<PrismaService, '$queryRaw'>,
  empresaId: number,
  cardCodes: string[],
) {
  if (!cardCodes.length)
    return new Map<
      string,
      { address: string; street: string; direccion: string }
    >();
  const filas = await prisma.$queryRaw<
    { CardCode: string; Address: string | null; Street: string | null }[]
  >`SELECT DISTINCT ON ("CardCode") "CardCode", "Address", "Street"
    FROM tbl_crd1
    WHERE empresa_id = ${empresaId} AND "CardCode" = ANY(${cardCodes})
    ORDER BY "CardCode", ("AdresType" = 'S') DESC NULLS LAST, id`;
  return new Map(
    filas.map((f) => [
      f.CardCode,
      {
        address: f.Address?.trim() ?? '',
        street: f.Street?.trim() ?? '',
        direccion: unirDireccion(f.Address, f.Street),
      },
    ]),
  );
}

/** Visitas: el local completo (radio incluido) en la forma pública. */
export function conLocalCampo<
  T extends { local: Parameters<typeof aLocalCampo>[0] },
>(fila: T) {
  return { ...fila, local: aLocalCampo(fila.local) };
}
