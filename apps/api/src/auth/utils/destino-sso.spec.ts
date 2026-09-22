import { UnauthorizedException } from '@nestjs/common';
import { destinoSsoSeguro } from './destino-sso';

describe('destinoSsoSeguro', () => {
  it('permite rutas del frontend configurado', () => {
    expect(
      destinoSsoSeguro(
        'http://192.168.10.104:3000/panel/campo',
        'http://192.168.10.104:3000',
      ),
    ).toBe('http://192.168.10.104:3000/panel/campo');
  });

  it('rechaza redirecciones hacia otro origen', () => {
    expect(() =>
      destinoSsoSeguro(
        'http://sitio-ajeno.example/robar-sesion',
        'http://192.168.10.104:3000',
      ),
    ).toThrow(UnauthorizedException);
  });
});
