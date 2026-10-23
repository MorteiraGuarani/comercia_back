import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SocioNegocioDto, SocioNegocioVendedorDto } from './tablas-socios.dto';

describe('Contrato OCRD ampliado', () => {
  it('admite los nuevos largos y omitir las banderas con valor predeterminado', async () => {
    const dto = plainToInstance(SocioNegocioDto, {
      CardCode: 'C'.repeat(50),
      CardName: 'N'.repeat(250),
      Phone1: '+595991188620',
      AliasName: 'A'.repeat(2000),
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('OSLP: Active es Y/N y se puede omitir; Memo y Fax son texto', async () => {
    const ok = plainToInstance(SocioNegocioVendedorDto, {
      SlpCode: 1,
      Memo: 'Zona centro',
      Fax: '021000000',
    });
    expect(await validate(ok)).toHaveLength(0);
    for (const Active of [null, 'X']) {
      const dto = plainToInstance(SocioNegocioVendedorDto, {
        SlpCode: 1,
        Active,
      });
      expect((await validate(dto)).some((e) => e.property === 'Active')).toBe(
        true,
      );
    }
  });

  it.each(['validFor', 'frozenFor'] as const)(
    'rechaza NULL y valores distintos de Y/N en %s antes de llegar a SQL',
    async (campo) => {
      for (const valor of [null, 'X', 1]) {
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

  it('un vacío no corta la fila: las banderas toman su default y los enteros quedan NULL', async () => {
    const dto = plainToInstance(SocioNegocioDto, {
      CardCode: 'C001',
      validFor: '',
      frozenFor: ' ',
      GroupCode: '',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      validFor: undefined,
      frozenFor: undefined,
      GroupCode: null,
    });
  });
});
