import type { CambiosAuditoria } from '../interfaces/auditoria.interface';

export const ACCIONES_AUDITORIA = [
  'CREAR',
  'MODIFICAR',
  'ELIMINAR',
  'ASIGNAR',
  'QUITAR',
] as const;

export const ENTIDADES_AUDITORIA = [
  'Usuario',
  'Rol',
  'Acceso por empresa',
  'Categoría',
  'Empresa',
  'Horario',
  'Asignación',
  'Backup',
  'Local',
  'Tarea',
] as const;

// Nunca al log: contraseñas, hashes, tokens, secretos ni credenciales (sapContrasenia, password_db…).
const SENSIBLE = /pass|hash|token|secret|contrase|clave|credencial/i;
const IGNORADOS = new Set(['updatedAt', '_count']);

/** Copia apta para JSON sin datos sensibles: fechas en ISO y bigint como texto. */
function limpiar(valor: unknown): Record<string, unknown> {
  if (valor === null || valor === undefined) return {};
  return JSON.parse(
    JSON.stringify(valor, (clave, v: unknown) =>
      SENSIBLE.test(clave) || IGNORADOS.has(clave)
        ? undefined
        : typeof v === 'bigint'
          ? v.toString()
          : v,
    ),
  ) as Record<string, unknown>;
}

/**
 * Los campos de `despues` que cambiaron respecto de `antes` (que puede traer
 * campos de más). En un alta (antes null) son todos los de después; en una
 * baja (después null), todos los de antes.
 */
export function cambiosAuditoria(
  antes: unknown,
  despues: unknown,
): CambiosAuditoria {
  const a = limpiar(antes);
  const d = limpiar(despues);
  const cambios: CambiosAuditoria = {};
  const campos = Object.keys(despues === null || despues === undefined ? a : d);
  for (const campo of campos) {
    const previo = a[campo] ?? null;
    const nuevo = d[campo] ?? null;
    if (JSON.stringify(previo) !== JSON.stringify(nuevo))
      cambios[campo] = { antes: previo, despues: nuevo };
  }
  return cambios;
}

/** "Nombre Apellido" para la etiqueta del registro. */
export function nombrePersona(u: { nombre: string; apellido: string }): string {
  return `${u.nombre} ${u.apellido}`.trim();
}
