import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
import { EjecutablesService } from './ejecutables.service';

const fila = {
  id: 3,
  nombre: 'HANA',
  servernode: 'hana:30015',
  userDb: 'SYSTEM',
  passwordDb: 'secreta',
  serviceLayer: null,
  versionTls: '1.2',
  _count: { ejecutables: 2 },
};

describe('Conexiones (ABM de superadmin)', () => {
  const prisma = {
    conexion: {
      findMany: jest.fn().mockResolvedValue([fila]),
      findUnique: jest.fn().mockResolvedValue(fila),
      update: jest.fn().mockResolvedValue(fila),
      delete: jest.fn(),
    },
  };
  const servicio = new EjecutablesService(prisma as unknown as PrismaService);

  it('nunca devuelve la contraseña, solo si está cargada', async () => {
    const [c] = await servicio.listarConexiones();
    expect(c).not.toHaveProperty('passwordDb');
    expect(c).toMatchObject({ tienePassword: true, ejecutables: 2 });
    expect(JSON.stringify(c)).not.toContain('secreta');
  });

  it('una contraseña vacía al editar conserva la actual', async () => {
    await servicio.actualizarConexion(3, { nombre: 'HANA 2', passwordDb: '' });
    expect(prisma.conexion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: { nombre: 'HANA 2', passwordDb: undefined },
      }),
    );
  });

  it('no elimina una conexión que usan ejecutables', async () => {
    await expect(servicio.eliminarConexion(3)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.conexion.delete).not.toHaveBeenCalled();
  });
});
