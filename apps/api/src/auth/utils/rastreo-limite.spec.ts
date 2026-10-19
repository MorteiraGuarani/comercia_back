import { JwtService } from '@nestjs/jwt';
import { rastreoPorSesion } from './rastreo-limite';
import { parseTrustProxy } from '../../config/env.schema';

describe('Límite de solicitudes por sesión', () => {
  const jwt = new JwtService({
    secret: 'secreto-de-prueba-con-32-caracteres!',
  });
  const otro = new JwtService({
    secret: 'otro-secreto-de-prueba-de-32-caracteres',
  });
  const rastrear = rastreoPorSesion(jwt);
  const ip = '172.18.0.5';

  it('cuenta por usuario con cookie o Bearer válidos, aunque todos lleguen con la IP del proxy', () => {
    const cookie = { ip, cookies: { comercia_token: jwt.sign({ sub: 3 }) } };
    const bearer = {
      ip,
      headers: { authorization: `Bearer ${jwt.sign({ sub: 4 })}` },
      cookies: { comercia_token: jwt.sign({ sub: 3 }) },
    };
    expect(rastrear(cookie)).toBe('usuario:3');
    expect(rastrear(bearer)).toBe('usuario:4');
  });

  it('cuenta por IP sin sesión o con tokens inventados o vencidos', () => {
    expect(rastrear({ ip })).toBe(`ip:${ip}`);
    expect(
      rastrear({ ip, cookies: { comercia_token: otro.sign({ sub: 3 }) } }),
    ).toBe(`ip:${ip}`);
    expect(
      rastrear({
        ip,
        headers: {
          authorization: `Bearer ${jwt.sign({ sub: 3 }, { expiresIn: -10 })}`,
        },
      }),
    ).toBe(`ip:${ip}`);
    expect(
      rastrear({ ip, cookies: { comercia_token: jwt.sign({ sub: 'x' }) } }),
    ).toBe(`ip:${ip}`);
  });

  it('interpreta TRUST_PROXY con la sintaxis de Express y queda apagado por defecto', () => {
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy(' 1 ')).toBe(1);
    expect(parseTrustProxy('loopback, uniquelocal')).toBe(
      'loopback, uniquelocal',
    );
  });
});
