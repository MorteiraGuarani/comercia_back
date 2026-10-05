import type { Prisma } from '../../../generated/prisma/client';
import type { DatosVersionTarea } from '../interfaces/datos-version-tarea.interface';

// Solo recibe el DTO público de la tarea; convierte fechas a ISO para el historial.
export function detalleTarea(tarea: object): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(tarea)) as Prisma.InputJsonValue;
}

export function datosTareaRegistrada<T extends DatosVersionTarea>(
  actual: T,
  detalle: Prisma.JsonValue | undefined | null,
  version?: number,
): T {
  if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle))
    return actual;
  const copia = { ...actual };
  for (const [campo, anterior] of [
    ['nombre', 'nombre'],
    ['descripcion', 'descripcion'],
    ['categoria', 'categoria'],
  ] as const) {
    const valor = detalle[campo] ?? detalle[anterior];
    if (typeof valor === 'string') copia[campo] = valor;
  }
  for (const [campo, anterior] of [
    ['requiereFotos', 'requiere_fotos'],
    ['fotosObligatorias', 'fotos_obligatorias'],
    ['esObligatoria', 'es_obligatoria'],
  ] as const) {
    const valor = detalle[campo] ?? detalle[anterior];
    if (typeof valor === 'boolean') copia[campo] = valor;
  }
  if (version !== undefined) copia.version = version;
  return copia;
}
