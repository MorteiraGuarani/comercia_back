import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { getSchemaPath } from '@nestjs/swagger';
import type { TablaSociosDefinicion } from '../interfaces/tabla-socios.interface';

export function esquemaRespuestaSocios(
  tabla: TablaSociosDefinicion,
): ApiResponseSchemaHost['schema'] {
  return {
    allOf: [
      { $ref: getSchemaPath(tabla.Dto) },
      {
        type: 'object',
        required: ['id', ...tabla.campos],
        properties: {
          id: {
            type: 'string',
            example: '1',
            description:
              'ID técnico interno como texto. Socios y direcciones se consultan por CardCode; canales/subcanales por Code; listas por ListNum; vendedores por SlpCode y supervisores por AgentCode, siempre dentro de empresaId.',
            readOnly: true,
          },
        },
      },
    ],
  };
}
export function esquemaPaginaSocios(
  tabla: TablaSociosDefinicion,
): ApiResponseSchemaHost['schema'] {
  return {
    type: 'object',
    required: ['items', 'total', 'page', 'limit', 'totalPages'],
    properties: {
      items: { type: 'array', items: esquemaRespuestaSocios(tabla) },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1, example: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 50, example: 7 },
      totalPages: { type: 'integer', minimum: 1 },
    },
  };
}
export function ejemploRespuestaSocios(tabla: TablaSociosDefinicion) {
  return {
    id: '1',
    ...Object.fromEntries(
      tabla.campos.map((campo) => [
        campo,
        tabla.ejemplo[campo] ?? tabla.predeterminados[campo] ?? null,
      ]),
    ),
  };
}
export function ejemplosSolicitudSocios(tabla: TablaSociosDefinicion) {
  const segundo = { ...tabla.ejemplo };
  const clave = tabla.nombre === 'tbl_crd1' ? 'Address' : tabla.clave[0];
  const valor = segundo[clave];
  segundo[clave] = typeof valor === 'number' ? valor + 1 : `${String(valor)}-2`;
  return {
    individual: {
      summary: `Una fila de ${tabla.nombre}`,
      value: tabla.ejemplo,
    },
    lote: {
      summary: 'Dos filas; se omiten claves existentes y duplicadas',
      value: [tabla.ejemplo, segundo],
    },
    ...(tabla.identidad
      ? {
          automatico: {
            summary: 'Code asignado automáticamente en esta empresa',
            value: { Name: 'Catálogo de ejemplo' },
          },
        }
      : {}),
  };
}
