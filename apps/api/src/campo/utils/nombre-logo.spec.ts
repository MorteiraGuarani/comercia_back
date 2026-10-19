import { leerNombreLogo } from './nombre-logo';

const UUID = '3f2b8c1e-7a4d-4e2b-9c1a-0b5d6e7f8a9b';

describe('leerNombreLogo', () => {
  it('lee la empresa de los logos nuevos y acepta los anteriores sin ella', () => {
    expect(leerNombreLogo(`logo_12_${UUID}.png`)).toEqual({
      nombre: `logo_12_${UUID}.png`,
      empresaId: 12,
    });
    expect(leerNombreLogo(`logo_${UUID}.svg`)).toEqual({
      nombre: `logo_${UUID}.svg`,
      empresaId: null,
    });
  });

  it('rechaza nombres ajenos o que intentan salir de la carpeta', () => {
    expect(leerNombreLogo('../../etc/passwd')).toBeNull();
    expect(leerNombreLogo(`logo_12_${UUID}.html`)).toBeNull();
    expect(leerNombreLogo(`foto_${UUID}.png`)).toBeNull();
  });
});
