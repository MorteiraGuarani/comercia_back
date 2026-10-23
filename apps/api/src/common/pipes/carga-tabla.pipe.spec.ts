import { BadRequestException } from '@nestjs/common';
import {
  ArticuloDto,
  PrecioListaDto,
} from '../../productos/dto/tablas-productos.dto';
import { CargaTablaPipe } from './carga-tabla.pipe';

describe('CargaTablaPipe', () => {
  const pipe = new CargaTablaPipe(ArticuloDto, true, undefined, ['ItemCode']);

  it('en un bulk saltea la fila inválida, la informa por campo y deja seguir al resto', async () => {
    await expect(
      pipe.transform([
        { ItemCode: 'A1', SWeight1: '1,5' },
        { ItemCode: 'A2', SWeight1: '1.5' },
        { ItemCode: 'A3', U_ItemQty: '1,5', extra: 1 },
      ]),
    ).resolves.toMatchObject({
      recibidos: 3,
      filas: [{ ItemCode: 'A2', SWeight1: '1.5' }],
      indices: [1],
      invalidas: [
        {
          index: 0,
          fila: 1,
          clave: { ItemCode: 'A1' },
          errores: [{ campo: 'SWeight1', valor: '1,5' }],
          motivo:
            'ItemCode A1: SWeight1 = "1,5": El decimal admite hasta 15 enteros y 6 decimales',
        },
        { index: 2, fila: 3, clave: { ItemCode: 'A3' } },
      ],
    });
  });

  it('un objeto suelto inválido sigue respondiendo 400 con el campo', async () => {
    await expect(
      pipe.transform({ ItemCode: 'A1', U_ItemQty: '1,5' }),
    ).rejects.toMatchObject({
      response: {
        message: [
          'U_ItemQty: El decimal admite hasta 15 enteros y 6 decimales',
        ],
        errores: [{ campo: 'U_ItemQty', valor: '1,5' }],
      },
    });
  });

  it('un cuerpo vacío o que no es arreglo de objetos sí se rechaza', async () => {
    await expect(pipe.transform([])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('un número o decimal vacío se guarda vacío y la fila entra con sus demás campos', async () => {
    await expect(
      pipe.transform([
        {
          ItemCode: 'A1',
          TaxCodeAR: '',
          SWeight1: ' ',
          ItmsGrpCod: '',
          U_ItemQty: '2',
        },
      ]),
    ).resolves.toMatchObject({
      filas: [
        {
          ItemCode: 'A1',
          TaxCodeAR: null,
          SWeight1: null,
          ItmsGrpCod: null,
          U_ItemQty: '2',
        },
      ],
      invalidas: [],
    });
  });

  it('una clave obligatoria vacía sigue saltando la fila', async () => {
    const lote = (await new CargaTablaPipe(PrecioListaDto, true, undefined, [
      'ItemCode',
      'PriceList',
    ]).transform([{ ItemCode: 'A1', PriceList: '', Price: '10' }])) as {
      invalidas: { errores: { campo: string }[] }[];
    };
    expect(lote.invalidas[0].errores[0].campo).toBe('PriceList');
  });
});
