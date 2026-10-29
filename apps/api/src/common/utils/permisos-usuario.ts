export function puedeAdministrarUsuarios(
  esSuperadmin: boolean,
  rolDescripcion: string | null,
): boolean {
  return esSuperadmin || rolDescripcion?.trim().toUpperCase() === 'GERENTE';
}

/** Roles de campo (operativos y sus líderes): ven "Mis datos" pero no lo editan. */
const ROLES_CAMPO = /^(repositor|impulsador|preventa|supervisor|teamleader)/;

/**
 * "Mis datos" lo editan superadmin y los roles administrativos (back office,
 * manager, gerente…). Sin rol asignado tampoco se edita.
 */
export function puedeEditarPerfil(
  esSuperadmin: boolean,
  rolDescripcion: string | null,
): boolean {
  if (esSuperadmin) return true;
  const rol = rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return !!rol && !ROLES_CAMPO.test(rol);
}
