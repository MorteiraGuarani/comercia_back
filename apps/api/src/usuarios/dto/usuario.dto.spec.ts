import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActualizarUsuarioDto,
  ActualizarUsuarioLoteDto,
  CrearUsuarioDto,
} from './usuario.dto';
import { ActualizarPerfilDto } from './perfil.dto';
import { MAX_INT4, MIN_INT4 } from '../../common/utils/numeros';

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

describe.each([
  CrearUsuarioDto,
  ActualizarUsuarioDto,
  ActualizarUsuarioLoteDto,
])('Campos ERP en %p', (Dto) => {
  const base = Dto === ActualizarUsuarioLoteDto ? { id: 7 } : {};

  it.each([
    ['ERP_CanalVenta', 50],
    ['ERP_Almacen', 8],
    ['ERP_Supervisor', 30],
    ['ERP_Repositor', 50],
    ['ERP_Impulsador', 50],
  ] as const)(
    'valida el límite de %s, conserva mayúsculas y permite vaciarlo',
    async (campo, maximo) => {
      const valido = plainToInstance(Dto, {
        ...base,
        [campo]: ` ${'A'.repeat(maximo)} `,
      });
      expect(await validate(valido)).toEqual([]);
      expect(valido[campo]).toBe('A'.repeat(maximo));
      const errores = await validate(
        plainToInstance(Dto, { ...base, [campo]: 'A'.repeat(maximo + 1) }),
      );
      expect(errores.some((e) => e.property === campo)).toBe(true);
      for (const vacio of [null, '', '   ']) {
        const dto = plainToInstance(Dto, { ...base, [campo]: vacio });
        expect(await validate(dto)).toEqual([]);
        expect(dto[campo]).toBeNull();
      }
    },
  );

  it.each([0, MIN_INT4, MAX_INT4, null, '', '   '])(
    'admite ERP_Vendedor %p',
    async (valor) => {
      expect(
        await validate(plainToInstance(Dto, { ...base, ERP_Vendedor: valor })),
      ).toEqual([]);
    },
  );

  it.each([MIN_INT4 - 1, MAX_INT4 + 1, 1.5, true, 'ABC', '27'])(
    'rechaza ERP_Vendedor inválido %p',
    async (valor) => {
      const errores = await validate(
        plainToInstance(Dto, { ...base, ERP_Vendedor: valor }),
      );
      expect(errores.some((e) => e.property === 'ERP_Vendedor')).toBe(true);
    },
  );
});

it('no permite editar referencias ERP desde el perfil propio', async () => {
  const dto = plainToInstance(ActualizarPerfilDto, { ERP_Almacen: 'ALM01' });
  const errores = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  expect(errores.some((e) => e.property === 'ERP_Almacen')).toBe(true);
});
