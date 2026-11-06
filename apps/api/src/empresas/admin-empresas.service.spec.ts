import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminEmpresasService } from './admin-empresas.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminEmpresasService', () => {
  const prisma = {
    empresa: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new AdminEmpresasService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rechaza borrar una empresa con datos asociados', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      _count: {
        usuarios: 0,
        clientes: 2,
        locales: 0,
        hijas: 0,
        tareas: 0,
        territorios: 0,
        zonas: 0,
      },
    });

    await expect(service.eliminar(9)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.empresa.delete).not.toHaveBeenCalled();
  });

  it('elimina una empresa vacía', async () => {
    prisma.empresa.findUnique.mockResolvedValue({
      id: 9,
      _count: {
        usuarios: 0,
        clientes: 0,
        locales: 0,
        hijas: 0,
        tareas: 0,
        territorios: 0,
        zonas: 0,
      },
    });
    prisma.empresa.delete.mockResolvedValue({ id: 9 });

    await expect(service.eliminar(9)).resolves.toEqual({ ok: true });
    expect(prisma.empresa.delete).toHaveBeenCalledWith({ where: { id: 9 } });
  });

  it('evita ciclos al elegir una empresa hija como matriz', async () => {
    prisma.empresa.findUnique
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({ empresaId: 9 });

    await expect(
      service.actualizar(9, { empresaId: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.empresa.update).not.toHaveBeenCalled();
  });

  it('guarda los datos de SAP sin devolver la contraseña y la conserva si llega vacía', async () => {
    const fila = {
      id: 9,
      nombre: 'Frigorífico',
      dbName: null,
      sapEsquema: 'SBO_FRIGO',
      sapUsuario: 'B1USER',
      sapContrasenia: 'secreta',
      diasAvisoVencimiento: 5,
      padre: null,
      _count: { usuarios: 0, hijas: 0, modulos: 0, paginas: 0 },
    };
    prisma.empresa.findUnique.mockResolvedValue({ id: 9 });
    prisma.empresa.update.mockResolvedValue(fila);

    const respuesta = await service.actualizar(9, {
      sapEsquema: 'SBO_FRIGO',
      sapUsuario: 'B1USER',
      sapContrasenia: '',
    });

    expect(prisma.empresa.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sapEsquema: 'SBO_FRIGO',
          sapUsuario: 'B1USER',
          sapContrasenia: undefined,
        }) as unknown,
      }),
    );
    expect(respuesta).toMatchObject({
      sapEsquema: 'SBO_FRIGO',
      sapUsuario: 'B1USER',
      tieneSapContrasenia: true,
    });
    expect(JSON.stringify(respuesta)).not.toContain('secreta');
  });
});
