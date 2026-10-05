import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { TareaCampoDto } from './dto/campo.dto';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';
import { datosTareaRegistrada } from './utils/version-tarea';

function contexto() {
  const tarea = {
    id: 8,
    version: 2,
    archivadaEn: null,
    nombre: 'Antes',
    descripcion: 'Original',
    locales: [],
    activo: true,
  };
  const prisma = {
    $queryRaw: jest.fn(),
    tareaCampo: {
      findFirst: jest.fn().mockResolvedValue(tarea),
      update: jest.fn().mockResolvedValue({
        ...tarea,
        version: 3,
        activo: false,
        archivadaEn: new Date(),
      }),
    },
    versionTareaCampo: { create: jest.fn() },
    cumplimientoCampo: { deleteMany: jest.fn() },
    tareaLocalCampo: { deleteMany: jest.fn() },
    novedadCampo: { updateMany: jest.fn() },
    localCampo: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (p: unknown) => unknown) =>
    fn(prisma),
  );
  const acceso = {
    gestionar: jest.fn().mockResolvedValue({
      id: 1,
      empresaId: 2,
      permisosTareas: ['CONSULTAR', 'CREAR', 'EDITAR', 'ARCHIVAR'],
      equipoCampo: {
        id: 9,
        nombre: 'Grupo',
        tipo: 'REPOSITOR',
        activo: true,
      },
    }),
  };
  return {
    prisma,
    servicio: new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    ),
  };
}

describe('Conservación de tareas', () => {
  it('archiva con versión y conserva cumplimientos, relaciones y novedades', async () => {
    const { prisma, servicio } = contexto();
    await servicio.eliminarTarea(1, 8);
    expect(prisma.tareaCampo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activo: false,
          archivadaEn: expect.any(Date) as unknown,
          version: { increment: 1 },
        }) as unknown,
      }),
    );
    expect(prisma.versionTareaCampo.create).toHaveBeenCalled();
    expect(prisma.cumplimientoCampo.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tareaLocalCampo.deleteMany).not.toHaveBeenCalled();
    expect(prisma.novedadCampo.updateMany).not.toHaveBeenCalled();
  });
  it('no crea otra versión al reintentar un archivo ya confirmado', async () => {
    const { prisma, servicio } = contexto();
    prisma.tareaCampo.findFirst.mockResolvedValue({
      id: 8,
      version: 3,
      archivadaEn: new Date(),
      nombre: 'Antes',
      descripcion: 'Original',
      locales: [],
      activo: false,
    });
    await servicio.eliminarTarea(1, 8);
    expect(prisma.tareaCampo.update).not.toHaveBeenCalled();
    expect(prisma.versionTareaCampo.create).not.toHaveBeenCalled();
  });
  it('rechaza un formulario viejo sin sobrescribir cambios de otro supervisor', async () => {
    const { prisma, servicio } = contexto();
    await expect(
      servicio.guardarTarea(
        1,
        Object.assign(new TareaCampoDto(), {
          nombre: 'Cambio',
          todosLocales: true,
          localIds: [],
          fechaDesde: '2026-10-05',
          versionEsperada: 1,
        }),
        8,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tareaCampo.update).not.toHaveBeenCalled();
  });
  it('mantiene las instrucciones y requisitos de la versión ya iniciada', () => {
    const actual = {
      nombre: 'Nueva',
      descripcion: 'Nueva regla',
      requiereFotos: false,
      fotosObligatorias: false,
      version: 5,
    };
    expect(
      datosTareaRegistrada(
        actual,
        {
          nombre: 'Original',
          descripcion: 'Original',
          requiere_fotos: true,
          fotos_obligatorias: true,
        },
        2,
      ),
    ).toMatchObject({
      nombre: 'Original',
      descripcion: 'Original',
      requiereFotos: true,
      fotosObligatorias: true,
      version: 2,
    });
  });
});
