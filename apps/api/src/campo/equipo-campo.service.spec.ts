import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DestinatarioTareaCampo } from '../../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from './campo-acceso.service';
import { TareaCampoDto } from './dto/campo.dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { CatalogoCampoService } from './catalogo-campo.service';
import { PlanificacionCampoService } from './planificacion-campo.service';

const casos = [
  [
    'SUPERVISOR_REPOSITORES',
    DestinatarioTareaCampo.REPOSITOR,
    DestinatarioTareaCampo.IMPULSADOR,
  ],
  [
    'SUPERVISOR',
    DestinatarioTareaCampo.IMPULSADOR,
    DestinatarioTareaCampo.REPOSITOR,
  ],
] as const;

function contexto(rol: string, equipo: DestinatarioTareaCampo) {
  const tareas = [
    { id: 1, empresaId: 10, destinatario: DestinatarioTareaCampo.IMPULSADOR },
    { id: 2, empresaId: 10, destinatario: DestinatarioTareaCampo.REPOSITOR },
  ];
  const prisma = {
    localCampo: { count: jest.fn().mockResolvedValue(0) },
    tareaCampo: {
      findFirst: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { id: number; empresaId: number; destinatario?: string };
          }) =>
            tareas.find(
              (t) =>
                t.id === where.id &&
                t.empresaId === where.empresaId &&
                (!where.destinatario || t.destinatario === where.destinatario),
            ) ?? null,
        ),
      create: jest
        .fn()
        .mockImplementation(
          ({ data }: { data: { destinatario: string } }) => data,
        ),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tareaLocalCampo: { deleteMany: jest.fn() },
    horarioCampo: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 5, localId: 20, destinatario: equipo }]),
      updateMany: jest
        .fn()
        .mockImplementation(
          ({ where }: { where: { destinatario?: string } }) => ({
            count: where.destinatario === equipo ? 0 : 1,
          }),
        ),
    },
    $transaction: jest
      .fn()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const acceso = {
    gestionar: jest
      .fn()
      .mockResolvedValue({ id: 3, empresaId: 10, rolDescripcion: rol }),
    local: jest.fn().mockResolvedValue({ id: 20 }),
  };
  return {
    prisma,
    catalogo: new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    ),
    planificacion: new PlanificacionCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    ),
  };
}

describe.each(casos)('Separación de equipo: %s', (rol, equipo, otroEquipo) => {
  it('deduce el destinatario al crear, sin depender del valor enviado por la web', async () => {
    const { catalogo, prisma } = contexto(rol, equipo);
    const dto = Object.assign(new TareaCampoDto(), {
      nombre: 'Control',
      fechaDesde: '2026-10-05',
    });
    await catalogo.guardarTarea(3, dto);
    expect(prisma.tareaCampo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          destinatario: equipo,
          empresaId: 10,
        }) as unknown,
      }),
    );
  });

  it.each([false, true])(
    'rechaza destinatarios ajenos o AMBOS (ambos=%s)',
    async (ambos) => {
      const { catalogo, prisma } = contexto(rol, equipo);
      const dto = Object.assign(new TareaCampoDto(), {
        nombre: 'Control',
        fechaDesde: '2026-10-05',
        destinatario: ambos ? DestinatarioTareaCampo.AMBOS : otroEquipo,
      });
      await expect(catalogo.guardarTarea(3, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('impide editar y borrar una tarea del otro equipo aunque comparta empresa y local', async () => {
    const { catalogo, prisma } = contexto(rol, equipo);
    const ajena = otroEquipo === DestinatarioTareaCampo.IMPULSADOR ? 1 : 2;
    const dto = Object.assign(new TareaCampoDto(), {
      nombre: 'Control',
      fechaDesde: '2026-10-05',
    });
    await expect(catalogo.guardarTarea(3, dto, ajena)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(catalogo.eliminarTarea(3, ajena)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('consulta los horarios generales de su equipo y rechaza borrar los ajenos', async () => {
    const { planificacion, prisma } = contexto(rol, equipo);
    await planificacion.horarios(3, 20, {});
    expect(prisma.horarioCampo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          localId: 20,
          asignacionId: null,
          destinatario: equipo,
          activo: true,
        },
      }),
    );
    await expect(
      planificacion.eliminarHorario(3, 20, 90),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
