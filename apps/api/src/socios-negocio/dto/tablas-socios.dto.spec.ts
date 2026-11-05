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

  it('OSLP: SalesEmployeeCode obligatorio; Active y Locked hasta 3 caracteres', async () => {
    const ok = plainToInstance(SocioNegocioVendedorDto, {
      SalesEmployeeCode: 1,
      Remarks: 'Zona centro',
      Active: 'Y',
      Locked: null,
      Email: 'vendedor@ejemplo.com.py',
    });
    expect(await validate(ok)).toHaveLength(0);
    const sinCodigo = plainToInstance(SocioNegocioVendedorDto, {
      SalesEmployeeName: 'X',
    });
    expect(
      (await validate(sinCodigo)).some(
        (e) => e.property === 'SalesEmployeeCode',
      ),
    ).toBe(true);
    const largo = plainToInstance(SocioNegocioVendedorDto, {
      SalesEmployeeCode: 1,
      Active: 'tYES',
    });
    expect((await validate(largo)).some((e) => e.property === 'Active')).toBe(
      true,
    );
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
