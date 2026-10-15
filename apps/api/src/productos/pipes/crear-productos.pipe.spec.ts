import { BadRequestException } from '@nestjs/common';
import { CrearProductosPipe } from './crear-productos.pipe';
import { MAX_PRODUCTOS_POR_LOTE } from '../productos.constants';

describe('Entrada individual o por lote de productos', () => {
  const producto = {
    itemcode: 'AV00018',
    itemname: 'PAPAS TRAD. 9,5 MM 4X2.5 KG-XL',
    iva: 10,
    itmsgrpcode: 143,
    pricelist: 13,
    price: 141650,
    tipo: null,
  };
  const pipe = new CrearProductosPipe();

  it('conserva el formato de objeto y valida y normaliza cada fila del arreglo', async () => {
    await expect(pipe.transform(producto)).resolves.toEqual(producto);
    await expect(
      pipe.transform([
        producto,
        { ...producto, itemcode: ' AV00018 ', pricelist: 14 },
      ]),
    ).resolves.toEqual([producto, { ...producto, pricelist: 14 }]);
  });

  it.each(
    [
      null,
      [],
      [null],
      [[]],
      ['texto'],
      Array(MAX_PRODUCTOS_POR_LOTE + 1).fill(producto),
    ].map((body) => [body]),
  )('rechaza un cuerpo o lote inválido (caso %#)', async (body) => {
    await expect(pipe.transform(body)).rejects.toThrow(BadRequestException);
  });

  it.each([
    { price: 'no-numero' },
    { iva: 32768 },
    { pricelist: null },
    { itemname: null },
    { empresa_id: 9 },
    { id: '1' },
  ])(
    'valida todas las filas e indica la posición inválida: %s',
    async (invalido) => {
      await expect(
        pipe.transform([producto, { ...producto, ...invalido }]),
      ).rejects.toMatchObject({
        response: {
          statusCode: 400,
          index: 1,
          message: 'Fila 2 inválida',
        },
      });
    },
  );
});
