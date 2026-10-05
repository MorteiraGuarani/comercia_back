import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CampoAccesoService } from '../campo-acceso.service';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../utils/autorizacion', () => ({
  obtenerEquipoCompleto: jest.fn().mockResolvedValue([5, 6, 7]),
}));
import { SeguimientoService } from './seguimiento.service';

describe('Seguimiento de colaboradores', () => {
  it('requiere permiso explícito incluso si la página está habilitada para el rol', async () => {
    const prisma = { usuario: { count: jest.fn() } };
    const acceso = {
      gestionar: jest
        .fn()
        .mockResolvedValue({ id: 5, empresaId: 2, puedeVerSeguimiento: false }),
    };
    const servicio = new SeguimientoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    await expect(servicio.equipo(5, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.usuario.count).not.toHaveBeenCalled();
  });
  it('pagina solo subordinados y marca como antigua la ubicación fuera de vigencia', async () => {
    const prisma = {
      usuario: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 6,
            nombre: 'Persona',
            apellido: 'Uno',
            rol: { descripcion: 'Rol nuevo', equipoCampoId: 3 },
            identidadUcheck: { ucheckUsuarioId: 11 },
            visitasCampo: [],
            seguimientoCampo: {
              activo: true,
              latitud: -25.3,
              longitud: -57.6,
              precisionMetros: 12,
              capturadaEn: new Date(Date.now() - 120000),
              recibidaEn: new Date(),
            },
          },
        ]),
      },
      seguimientoCampo: { count: jest.fn().mockResolvedValue(0) },
      visitaCampo: { count: jest.fn().mockResolvedValue(0) },
      operacionCampo: { count: jest.fn().mockResolvedValue(0) },
    };
    const acceso = {
      gestionar: jest
        .fn()
        .mockResolvedValue({ id: 5, empresaId: 2, puedeVerSeguimiento: true }),
    };
    const servicio = new SeguimientoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    const r = await servicio.equipo(5, { page: 1, limit: 7 });
    expect(r.items[0].telefono.estado).toBe('DESACTUALIZADO');
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [6, 7] }, empresaId: 2, isActive: true },
        skip: 0,
        take: 7,
      }),
    );
    expect(r.items[0]).not.toHaveProperty('correo');
  });
});
