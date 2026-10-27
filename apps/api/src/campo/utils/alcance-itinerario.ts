import type { UsuarioConAcceso } from '../../plataforma/interfaces/usuario-con-acceso.interface';

/** Los perfiles administrativos conservan el catálogo completo de su empresa. */
export function restringirItinerarioAlEquipo(
  usuario: Pick<UsuarioConAcceso, 'rolDescripcion' | 'equipoCampo'>,
): boolean {
  const rol =
    usuario.rolDescripcion?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
  return (
    usuario.equipoCampo?.tipo === 'IMPULSADOR' &&
    !rol.includes('backoffice') &&
    (rol.startsWith('supervisor') || rol.startsWith('teamleader'))
  );
}
