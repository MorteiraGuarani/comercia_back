import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ToleranciasService } from './tolerancias.service';
import { ToleranciaHorarioDto } from './dto/tolerancia-horario.dto';

describe('Configuración autorizada de tolerancias', () => {
  it('limita a los gestores a los horarios de su empresa y equipo', async () => {
    const prisma = {
      usuario: {
        findFirst: jest.fn().mockResolvedValue({ esSuperadmin: false }),
      },
      horarioCampo: { findFirst: jest.fn().mockResolvedValue(null) },
      configuracionTolerancia: { findMany: jest.fn(), upsert: jest.fn() },
    };
    const servicio = new ToleranciasService(
      prisma as never,
      {
        gestionar: jest
          .fn()
          .mockResolvedValue({ empresaId: 10, equipoCampo: { id: 3 } }),
      } as never,
    );
    await expect(servicio.guardar(2, 'horario', 88, {})).rejects.toThrow(
      'Horario no disponible',
    );
    expect(prisma.horarioCampo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 88,
          activo: true,
          equipoCampoId: 3,
          empresaId: 10,
        },
      }),
    );
    expect(prisma.configuracionTolerancia.upsert).not.toHaveBeenCalled();
  });
  const preparar = () => {
    const prisma = {
      usuario: {
        findFirst: jest.fn().mockResolvedValue({ esSuperadmin: true }),
      },
      empresa: {
        findUnique: jest.fn().mockResolvedValue({ id: 10 }),
        findFirst: jest.fn().mockResolvedValue({ id: 10 }),
      },
      horarioCampo: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      configuracionTolerancia: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'global:0', valores: { toleranciaEntrada: 8 } },
          { clave: 'empresa:10', valores: { anticipoEntrada: 20 } },
        ]),
        upsert: jest.fn(),
      },
    };
    return {
      prisma,
      servicio: new ToleranciasService(
        prisma as never,
        { gestionar: jest.fn() } as never,
      ),
    };
  };
  it('hereda por campo y no expone entidades privadas', async () => {
    const { servicio } = preparar();
    const d = await servicio.consultar(1, 'empresa', 10);
    expect(d.efectivos).toMatchObject({
      toleranciaEntrada: 8,
      anticipoEntrada: 20,
    });
    expect(Object.keys(d).sort()).toEqual([
      'alcance',
      'efectivos',
      'heredados',
      'id',
      'valores',
    ]);
  });
  it('impide cambiar la configuración global sin superadmin', async () => {
    const { prisma, servicio } = preparar();
    prisma.usuario.findFirst.mockResolvedValue({ esSuperadmin: false });
    await expect(servicio.guardar(2, 'global', 0, {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.configuracionTolerancia.upsert).not.toHaveBeenCalled();
  });
  it('rechaza ámbitos inventados o ids inválidos antes de consultar datos', async () => {
    const { servicio } = preparar();
    await expect(servicio.consultar(1, 'otro', 10)).rejects.toThrow(
      BadRequestException,
    );
    await expect(servicio.consultar(1, 'global', 4)).rejects.toThrow(
      BadRequestException,
    );
  });
  it('impide límites amarillos menores que la tolerancia verde', async () => {
    const { prisma, servicio } = preparar();
    await expect(
      servicio.guardar(1, 'empresa', 10, {
        toleranciaEntrada: 31,
        limiteEntrada: 30,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.configuracionTolerancia.upsert).not.toHaveBeenCalled();
  });

  it('acepta cero y null pero rechaza negativos, decimales y cadenas', async () => {
    expect(
      await validate(
        plainToInstance(ToleranciaHorarioDto, {
          anticipoEntrada: 0,
          toleranciaEntrada: null,
        }),
      ),
    ).toHaveLength(0);
    for (const valor of [-1, 0.5, 1441, '14'])
      expect(
        (
          await validate(
            plainToInstance(ToleranciaHorarioDto, { anticipoEntrada: valor }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
});
