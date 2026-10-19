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

  it('usa 1 MB para el resto de la API y deja el login por SIM apagado', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(env.HTTP_BODY_LIMIT_GENERAL_MB).toBe(1);
    expect(env.LOGIN_SIM_HABILITADO).toBe(false);
    expect(env.FOTOS_RETENCION_DIAS).toBe(0);
    expect(() =>
      validateEnv({ NODE_ENV: 'test', FOTOS_RETENCION_DIAS: '30' }),
    ).toThrow('FOTOS_RETENCION_DIAS');
    expect(
      validateEnv({ NODE_ENV: 'test', LOGIN_SIM_HABILITADO: 'true' })
        .LOGIN_SIM_HABILITADO,
    ).toBe(true);
  });
});
