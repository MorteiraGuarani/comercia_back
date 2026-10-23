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
    { itemcode: 'A'.repeat(16) },
    { itmsgrpcode: 32768 },
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
          message: expect.stringMatching(/^Fila 2 inválida — /) as unknown,
          filasInvalidas: [expect.objectContaining({ index: 1, fila: 2 })],
        },
      });
    },
  );

  it('dice el campo, el valor recibido y el motivo, y junta todas las filas inválidas', async () => {
    const error = (await pipe
      .transform([
        { ...producto, price: '' },
        producto,
        { ...producto, iva: 'diez', extra: 1 },
      ])
      .catch((e: unknown) => e)) as BadRequestException;
    const r = error.getResponse() as Record<string, unknown>;
    expect(r.message).toBe(
      'Fila 1 inválida — price = "": El decimal admite hasta 15 enteros y 6 decimales. Hay 2 filas con errores, detalladas en filasInvalidas',
    );
    expect(r.errores).toEqual([
      {
        campo: 'price',
        valor: '',
        mensajes: ['El decimal admite hasta 15 enteros y 6 decimales'],
      },
    ]);
    const filas = r.filasInvalidas as {
      fila: number;
      errores: { campo: string }[];
    }[];
    expect(filas.map((f) => f.fila)).toEqual([1, 3]);
    expect(filas[1].errores.map((e) => e.campo).sort()).toEqual([
      'extra',
      'iva',
    ]);
  });
});
