import { alertasOrganigrama } from './organigrama';

const p = (
  id: number,
  superiorId: number | null,
  equipoId: number | null,
  extra: { activo?: boolean; tieneRol?: boolean } = {},
) => ({ id, superiorId, equipoId, activo: true, tieneRol: true, ...extra });

describe('alertasOrganigrama', () => {
  it('explica por qué alguien no aparece en el Presentismo de su líder', () => {
    const a = alertasOrganigrama(
      [
        p(1, null, 4), // supervisor sin nadie a cargo
        p(2, null, 4), // back office con un repositor
        p(3, 2, 4),
        p(4, 2, 2), // otro equipo que su superior
        p(5, 6, 4), // superior inactivo
        p(6, null, 4, { activo: false }),
        p(7, 99, 4), // superior que no está en la empresa
        p(8, 2, null), // rol sin equipo operativo
        p(9, 2, null, { tieneRol: false }),
      ],
      null,
    );
    expect(Object.fromEntries(a)).toEqual({
      1: ['AISLADO'],
      2: [],
      3: [],
      4: ['OTRO_EQUIPO'],
      5: ['SUPERIOR_INACTIVO'],
      6: [],
      7: ['SUPERIOR_FUERA'],
      8: ['SIN_EQUIPO'],
      9: ['SIN_ROL'],
    });
  });

  it('en la vista de un líder no marca la raíz ni a los que no tienen superior', () => {
    const a = alertasOrganigrama([p(1, 50, 4), p(2, 1, 4)], 1);
    expect(a.get(1)).toEqual([]);
    expect(a.get(2)).toEqual([]);
  });
});
