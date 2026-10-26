import { ForbiddenException } from '@nestjs/common';
import { filtroPersonalEquipoOperativo } from './personal-equipo';

describe('Aislamiento del personal de planificación', () => {
  it('restringe por empresa, equipo exacto y estado, excluyendo al actor y superadmins', () => {
    expect(
      filtroPersonalEquipoOperativo({
        id: 11,
        empresaId: 10,
        equipoCampo: {
          id: 4,
          nombre: 'Repositores Norte',
          tipo: 'REPOSITOR',
          activo: true,
        },
      }),
    ).toEqual({
      empresaId: 10,
      id: { not: 11 },
      isActive: true,
      esSuperadmin: false,
      rol: { equipoCampoId: 4 },
    });
  });

  it('rechaza un equipo ausente o desactivado en vez de ampliar el alcance', () => {
    expect(() =>
      filtroPersonalEquipoOperativo({ id: 11, empresaId: 10 }),
    ).toThrow(ForbiddenException);
    expect(() =>
      filtroPersonalEquipoOperativo({
        id: 11,
        empresaId: 10,
        equipoCampo: {
          id: 4,
          nombre: 'Inactivo',
          tipo: 'IMPULSADOR',
          activo: false,
        },
      }),
    ).toThrow(ForbiddenException);
  });
});
