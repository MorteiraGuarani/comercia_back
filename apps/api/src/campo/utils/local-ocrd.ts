import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { ZONA_CAMPO } from './calendario';

/** OCRD no guarda radio: todos los locales usan el mismo geocerco. */
export const RADIO_LOCAL_METROS = 100;

/** Campos de tbl_ocrd que la operación de campo usa como local. */
export const LOCAL_OCRD_SELECT = {
  CardCode: true,
  CardName: true,
  U_Latitud: true,
  U_Longitud: true,
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
  },
  direccion = '',
) {
  return {
    id: l.CardCode,
    nombre: nombreLocal(l),
    direccion,
    latitud: coordenadaOcrd(l.U_Latitud),
    longitud: coordenadaOcrd(l.U_Longitud),
    radioMetros: RADIO_LOCAL_METROS,
    zonaHoraria: ZONA_CAMPO,
  };
}

/** Texto que se guarda en OCRD al marcar el punto en el mapa. */
export function textoCoordenada(valor: number) {
  return valor.toFixed(7);
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
  if (!cardCodes.length) return new Map<string, string>();
  const filas = await prisma.$queryRaw<
    { CardCode: string; direccion: string }[]
  >`SELECT DISTINCT ON ("CardCode") "CardCode",
      concat_ws(', ', NULLIF(TRIM("Address"), ''), NULLIF(TRIM("Street"), '')) AS direccion
    FROM tbl_crd1
    WHERE empresa_id = ${empresaId} AND "CardCode" = ANY(${cardCodes})
    ORDER BY "CardCode", ("AdresType" = 'S') DESC NULLS LAST, id`;
  return new Map(filas.map((f) => [f.CardCode, f.direccion]));
}

/** Visitas: el local completo (radio incluido) en la forma pública. */
export function conLocalCampo<
  T extends { local: Parameters<typeof aLocalCampo>[0] },
>(fila: T) {
  return { ...fila, local: aLocalCampo(fila.local) };
}
