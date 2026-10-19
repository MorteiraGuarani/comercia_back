import { detectarTipoImagen } from './firma-imagen';

describe('detectarTipoImagen', () => {
  it('reconoce JPG, PNG y WebP por su firma', () => {
    expect(
      detectarTipoImagen(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])),
    ).toEqual({ mime: 'image/jpeg', extension: '.jpg' });
    expect(
      detectarTipoImagen(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toEqual({ mime: 'image/png', extension: '.png' });
    expect(
      detectarTipoImagen(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBP')),
    ).toEqual({ mime: 'image/webp', extension: '.webp' });
  });

  it('rechaza un SVG o un HTML aunque digan ser imagen', () => {
    expect(detectarTipoImagen(Buffer.from('<svg xmlns="http'))).toBeNull();
    expect(detectarTipoImagen(Buffer.from('<!doctype html>'))).toBeNull();
    expect(detectarTipoImagen(new Uint8Array())).toBeNull();
  });
});
