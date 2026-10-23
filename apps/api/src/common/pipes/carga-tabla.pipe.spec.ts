import { BadRequestException } from '@nestjs/common';
import { ArticuloDto } from '../../productos/dto/tablas-productos.dto';
import { CargaTablaPipe } from './carga-tabla.pipe';

describe('CargaTablaPipe', () => {
  const pipe = new CargaTablaPipe(ArticuloDto);

  it('en un bulk saltea la fila inválida, la informa por campo y deja seguir al resto', async () => {
    await expect(
      pipe.transform([
        { ItemCode: 'A1', SWeight1: '' },
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
          errores: [{ campo: 'SWeight1', valor: '' }],
          motivo:
            'SWeight1 = "": El decimal admite hasta 15 enteros y 6 decimales',
        },
        { index: 2, fila: 3 },
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
});
