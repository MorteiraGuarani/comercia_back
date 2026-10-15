import { validateEnv } from './env.schema';

describe('Límite configurable del cuerpo HTTP', () => {
  it('usa 50 MB por defecto y permite configurar otro tamaño', () => {
    expect(validateEnv({ NODE_ENV: 'test' }).HTTP_BODY_LIMIT_MB).toBe(50);
    expect(
      validateEnv({ NODE_ENV: 'test', HTTP_BODY_LIMIT_MB: '100' })
        .HTTP_BODY_LIMIT_MB,
    ).toBe(100);
  });

  it.each([0, -1, 257, 'sin-limite', 1.5])(
    'rechaza un límite inválido: %s',
    (value) => {
      expect(() =>
        validateEnv({ NODE_ENV: 'test', HTTP_BODY_LIMIT_MB: value }),
      ).toThrow('HTTP_BODY_LIMIT_MB');
    },
  );
});
