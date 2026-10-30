import { aLocalCampo, coordenadaOcrd, unirDireccion } from './local-ocrd';

describe('local-ocrd', () => {
  it('une Address y Street sin repetir la misma dirección con otros espacios', () => {
    expect(unirDireccion('AVDA. X - LIMPIO', 'avda. x -LIMPIO')).toBe('AVDA. X - LIMPIO');
    expect(unirDireccion('Calle 1', 'Barrio 2')).toBe('Calle 1, Barrio 2');
    expect(unirDireccion('', ' B ')).toBe('B');
    expect(unirDireccion(null, null)).toBe('');
  });

  it('lee coordenadas de SAP con punto o coma y rechaza texto vacío o inválido', () => {
    expect(coordenadaOcrd(' -25.2867 ')).toBe(-25.2867);
    expect(coordenadaOcrd('-57,647')).toBe(-57.647);
    expect(coordenadaOcrd('')).toBeNull();
    expect(coordenadaOcrd(null)).toBeNull();
    expect(coordenadaOcrd('sin dato')).toBeNull();
  });

  it('usa CardCode como id y como nombre cuando falta CardName', () => {
    expect(
      aLocalCampo({
        CardCode: 'C001',
        CardName: '  ',
        U_Latitud: '-25.3',
        U_Longitud: null,
        U_RadioMetros: 250,
      }),
    ).toMatchObject({
      id: 'C001',
      nombre: 'C001',
      latitud: -25.3,
      longitud: null,
      radioMetros: 250,
    });
  });
});
