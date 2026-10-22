import { aLocalCampo, coordenadaOcrd } from './local-ocrd';

describe('local-ocrd', () => {
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
      }),
    ).toMatchObject({
      id: 'C001',
      nombre: 'C001',
      latitud: -25.3,
      longitud: null,
    });
  });
});
