import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarUsuarioDto } from './usuario.dto';

describe('Edición del correo del usuario', () => {
  it('normaliza un correo válido y permite omitirlo', async () => {
    const dto = plainToInstance(ActualizarUsuarioDto, {
      correo: ' ANA@GMAIL.COM ',
    });
    expect(dto.correo).toBe('ana@gmail.com');
    expect(await validate(dto)).toEqual([]);
    expect(
      await validate(plainToInstance(ActualizarUsuarioDto, { isActive: true })),
    ).toEqual([]);
  });

  it.each([null, '', 'sin-correo', 'a'.repeat(121), 123])(
    'rechaza un correo inválido: %s',
    async (correo) => {
      const errores = await validate(
        plainToInstance(ActualizarUsuarioDto, { correo }),
      );
      expect(errores.some((error) => error.property === 'correo')).toBe(true);
    },
  );
});
