import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { RegistroMarcacionesService } from './registro-marcaciones.service';

jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('RegistroMarcacionesService', () => {
  const prisma = {
    registroMarcacionCampo: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([{ id: 5 }]),
    },
    usuario: { findUnique: jest.fn() },
  };
  const servicio = new RegistroMarcacionesService(
    prisma as unknown as PrismaService,
  );
  const fila = {
    ruta: 'POST /api/campo/jornada/marcas-sin-conexion',
    tipo: 'ENTRADA',
    resultado: 'RECHAZADA',
    usuarioId: 3,
    estadoHttp: 400,
    motivo: 'Estás fuera del radio permitido',
    duracionMs: 40,
    solicitud: { body: { ubicacion: { latitud: -25.3 } } },
  };
  const guardado = () =>
    (
      prisma.registroMarcacionCampo.create.mock.calls.at(-1) as [
        { data: Record<string, unknown> },
      ]
    )[0].data;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.registroMarcacionCampo.create.mockResolvedValue({ id: 1 });
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Delio',
      apellido: 'Gómez',
      correo: 'delio@example.com',
      nombreLogin: 'delio.gomez',
      empresaId: 2,
      empresa: { nombre: 'Frigorífico Guaraní' },
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('guarda quién marcó: nombre, correo, login y empresa de ese momento', async () => {
    await servicio.registrar(fila);
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3 } }),
    );
    expect(guardado()).toMatchObject({
      usuarioId: 3,
      usuarioNombre: 'Delio Gómez',
      usuarioCorreo: 'delio@example.com',
      usuarioLogin: 'delio.gomez',
      empresaId: 2,
      empresaNombre: 'Frigorífico Guaraní',
      solicitud: { body: { ubicacion: { latitud: -25.3 } } },
    });
  });

  it('si la base falla, la marca no se corta', async () => {
    prisma.registroMarcacionCampo.create.mockRejectedValue(
      new Error('tabla inexistente'),
    );
    await expect(servicio.registrar(fila)).resolves.toBeUndefined();
  });

  it('lista de la más reciente a la más antigua, filtrando por resultado', async () => {
    const r = await servicio.listar({
      resultado: 'RECHAZADA',
      page: 2,
      limit: 7,
    });
    expect(prisma.registroMarcacionCampo.findMany).toHaveBeenCalledWith({
      where: { resultado: 'RECHAZADA' },
      orderBy: { id: 'desc' },
      skip: 7,
      take: 7,
    });
    expect(r).toMatchObject({
      items: [{ id: 5 }],
      total: 1,
      page: 2,
      limit: 7,
    });
  });
});
