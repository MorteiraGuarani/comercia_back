import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SocioNegocioDto } from './tablas-socios.dto';

describe('Contrato OCRD ampliado', () => {
  it('admite los nuevos largos y omitir las banderas con valor predeterminado', async () => {
    const dto = plainToInstance(SocioNegocioDto, {
      CardCode: 'C'.repeat(50),
      CardName: 'N'.repeat(250),
      Phone1: '+595991188620',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['validFor', 'frozenFor'] as const)(
    'rechaza NULL y valores distintos de Y/N en %s antes de llegar a SQL',
    async (campo) => {
      for (const valor of [null, '', 'X', 1]) {
        const dto = plainToInstance(SocioNegocioDto, {
          CardCode: 'C001',
          [campo]: valor,
        });
        expect(
          (await validate(dto)).some((error) => error.property === campo),
        ).toBe(true);
      }
      for (const valor of ['Y', 'N']) {
        const dto = plainToInstance(SocioNegocioDto, {
          CardCode: 'C001',
          [campo]: valor,
        });
        expect(await validate(dto)).toHaveLength(0);
      }
    },
  );
});
