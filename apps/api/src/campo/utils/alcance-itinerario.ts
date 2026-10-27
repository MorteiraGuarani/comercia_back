import type { UsuarioConAcceso } from '../../plataforma/interfaces/usuario-con-acceso.interface';

/**
 * Supervisores y team leaders de un equipo de campo (impulsadores o
 * repositores) ven solo los locales asignados a su equipo. Los perfiles
 * administrativos (back office, administrador) conservan el catálogo completo.
 */
export function restringirItinerarioAlEquipo(
  usuario: Pick<UsuarioConAcceso, 'rolDescripcion' | 'equipoCampo'>,
): boolean {
  const rol =
    usuario.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return (
    !!usuario.equipoCampo &&
    !rol.includes('backoffice') &&
    (rol.startsWith('supervisor') || rol.startsWith('teamleader'))
  );
}
