import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { CampoAccesoService } from '../campo/campo-acceso.service';
import type { JornadaCampoService } from '../campo/jornada-campo.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { IntegracionesUcheckService } from './integraciones-ucheck.service';

function contexto() {
  const prisma = {
    identidadUcheck: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ usuarioId: 8, ucheckUsuarioId: 11 }),
      create: jest.fn(),
    },
    usuario: {
      findFirst: jest.fn().mockResolvedValue({ id: 8 }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ permitirVinculoAutomatico: true }),
    },
    seguimientoCampo: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (p: unknown) => unknown) =>
    fn(prisma),
  );
  const acceso = { ejecutar: jest.fn().mockResolvedValue({ id: 8 }) };
  const jornada = {
    agenda: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 7,
      totalPages: 1,
    }),
  };
  const servicio = new IntegracionesUcheckService(
    prisma as unknown as PrismaService,
    acceso as unknown as CampoAccesoService,
    jornada as unknown as JornadaCampoService,
  );
  const dto = {
    ucheckUsuarioId: 11,
    correo: 'persona@example.com',
    jornadaId: '59e1fc97-4d60-42ee-a134-1fbaf7d6e5c5',
    activo: true,
    iniciadaEn: new Date().toISOString(),
    reportadaEn: new Date().toISOString(),
    capturadaEn: new Date().toISOString(),
    latitud: -25.3,
    longitud: -57.6,
    precisionMetros: 10,
  };
  return { prisma, servicio, dto, jornada };
}
describe('Integración de ubicaciones', () => {
  it('resuelve la cuenta por la identidad estable y verifica acceso operativo', async () => {
    const { prisma, servicio, dto } = contexto();
    await servicio.registrarSeguimiento(dto);
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, isActive: true, esSuperadmin: false },
      }),
    );
    expect(prisma.seguimientoCampo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 8 } }),
    );
  });
  it('un reporte antiguo no vuelve a colocar un punto después de finalizar', async () => {
    const { prisma, servicio, dto } = contexto();
    prisma.seguimientoCampo.findUnique.mockResolvedValue({
      reportadaEn: new Date(Date.now() + 1000),
    });
    expect(await servicio.registrarSeguimiento(dto)).toMatchObject({
      omitida: true,
    });
    expect(prisma.seguimientoCampo.upsert).not.toHaveBeenCalled();
  });
  it('la finalización elimina coordenadas y nunca deja un punto como activo', async () => {
    const { prisma, servicio, dto } = contexto();
    await servicio.registrarSeguimiento({ ...dto, activo: false });
    expect(prisma.seguimientoCampo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          activo: false,
          latitud: null,
          longitud: null,
          capturadaEn: null,
        }) as unknown,
      }),
    );
  });
  it('una cuenta desvinculada expresamente no se vuelve a vincular por correo', async () => {
    const { prisma, servicio, dto } = contexto();
    prisma.identidadUcheck.findUnique.mockResolvedValue(null);
    prisma.usuario.findUnique.mockResolvedValue({
      permitirVinculoAutomatico: false,
    });
    await expect(servicio.registrarSeguimiento(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.identidadUcheck.create).not.toHaveBeenCalled();
  });
  it('un reporte iniciado antes de desvincular no restaura el punto despues', async () => {
    const { prisma, servicio, dto } = contexto();
    prisma.identidadUcheck.findUnique
      .mockResolvedValueOnce({ usuarioId: 8, ucheckUsuarioId: 11 })
      .mockResolvedValueOnce(null);
    prisma.usuario.findUnique.mockResolvedValue({
      permitirVinculoAutomatico: false,
    });
    await expect(servicio.registrarSeguimiento(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.seguimientoCampo.upsert).not.toHaveBeenCalled();
  });
  it('la agenda usa el vinculo estable aunque cambie el correo de Ucheck', async () => {
    const { prisma, servicio, jornada } = contexto();
    prisma.usuario.findFirst.mockResolvedValue({
      id: 8,
      correo: 'anterior@example.com',
    });
    await servicio.agenda({
      correo: 'nuevo@example.com',
      ucheckUsuarioId: 11,
      fecha: '2026-10-05',
      page: 1,
      limit: 7,
    });
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, isActive: true, esSuperadmin: false },
      }),
    );
    expect(jornada.agenda).toHaveBeenCalledWith(8, {
      fecha: '2026-10-05',
      page: 1,
      limit: 7,
    });
  });
});
