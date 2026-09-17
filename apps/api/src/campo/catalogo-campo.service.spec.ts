import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';

describe('Catálogo de tareas', () => {
  it('filtra antes de paginar y calcula el resumen de toda la empresa', async () => {
    const prisma = {
      tareaCampo: {
        count: jest.fn().mockResolvedValueOnce(9).mockResolvedValueOnce(30).mockResolvedValueOnce(12).mockResolvedValueOnce(15),
        findMany: jest.fn().mockResolvedValue([{ id: 8, nombre: 'Precios' }]),
      },
    };
    const acceso = { gestionar: jest.fn().mockResolvedValue({ id: 1, empresaId: 10 }) };
    const service = new CatalogoCampoService(prisma as unknown as PrismaService, acceso as unknown as CampoAccesoService);
    const respuesta = await service.tareas(1, { page: 2, limit: 7, categoria: 'Precios', tipo: 'con_fotos', buscar: 'cartel' });
    expect(acceso.gestionar).toHaveBeenCalledWith(1, 'tareas');
    expect(prisma.tareaCampo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 7, take: 7,
      where: { empresaId: 10, categoria: 'Precios', requiereFotos: true, OR: [
        { nombre: { contains: 'cartel', mode: 'insensitive' } },
        { descripcion: { contains: 'cartel', mode: 'insensitive' } },
      ] },
    }));
    expect(respuesta.resumen).toEqual({ total: 30, obligatorias: 12, conFotos: 15 });
    expect(respuesta.total).toBe(9);
  });
});
