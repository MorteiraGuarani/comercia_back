import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RegistroSocio } from './interfaces/registro-socio.interface';
import { SociosNegocioService } from './socios-negocio.service';
import {
  TABLAS_SOCIOS,
  SOCIOS_POR_BLOQUE,
  TIMEOUT_LOTE_SOCIOS_MS,
} from './tablas-socios';
import { ejemploRespuestaSocios } from './utils/swagger-socios';

function modelo() {
  return {
    count: jest.fn<Promise<number>, [object]>().mockResolvedValue(0),
    findMany: jest
      .fn<Promise<RegistroSocio[]>, [object]>()
      .mockResolvedValue([]),
    findFirst: jest
      .fn<Promise<RegistroSocio | null>, [object]>()
      .mockResolvedValue(null),
    create: jest.fn<Promise<RegistroSocio>, [object]>(),
    createMany: jest
      .fn<Promise<{ count: number }>, [object]>()
      .mockResolvedValue({ count: 1 }),
    update: jest.fn<Promise<RegistroSocio>, [object]>(),
    delete: jest.fn<Promise<RegistroSocio>, [object]>(),
    aggregate: jest
      .fn<Promise<{ _max: { Code: number | null } }>, [object]>()
      .mockResolvedValue({ _max: { Code: null } }),
  };
}
function preparar() {
  const modelos = Object.fromEntries<ReturnType<typeof modelo>>(
    Object.values(TABLAS_SOCIOS).map((tabla) => {
      const repositorio = modelo();
      const fila = {
        ...ejemploRespuestaSocios(tabla),
        id: 9007199254740993n,
        empresaId: 20,
        interno: 'no exponer',
      };
      repositorio.findFirst.mockResolvedValue(fila);
      repositorio.findMany.mockResolvedValue([fila]);
      repositorio.create.mockResolvedValue(fila);
      repositorio.update.mockResolvedValue(fila);
      repositorio.delete.mockResolvedValue(fila);
      return [tabla.modelo, repositorio];
    }),
  );
  const tx = {
    ...modelos,
    empresa: {
      findUnique: jest
        .fn<Promise<{ id: number } | null>, [object]>()
        .mockResolvedValue({ id: 20 }),
    },
    $queryRaw: jest
      .fn<Promise<Array<{ id: number }>>, [unknown, ...unknown[]]>()
      .mockResolvedValue([{ id: 20 }]),
  };
  const db = {
    ...tx,
    $transaction: jest.fn(
      (operacion: (cliente: Prisma.TransactionClient) => Promise<unknown>) =>
        operacion(tx as unknown as Prisma.TransactionClient),
    ),
  };
  return {
    db,
    modelos,
    service: new SociosNegocioService(db as unknown as PrismaService),
  };
}

describe('Socios de negocio públicos y separados por empresa', () => {
  it.each(Object.values(TABLAS_SOCIOS))(
    '$nombre: pagina, proyecta y restringe todas las operaciones a la empresa sin sesión',
    async (tabla) => {
      const { modelos, db, service } = preparar();
      const repositorio = modelos[tabla.modelo];
      const pagina = await service.listar(tabla, 20, {});
      expect(pagina.limit).toBe(7);
      expect(Object.keys(pagina.items[0]).sort()).toEqual(
        ['id', ...tabla.campos].sort(),
      );
      expect(pagina.items[0].id).toBe('9007199254740993');
      expect(repositorio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { empresaId: 20 }, skip: 0, take: 7 }),
      );
      await service.obtener(tabla, 20, '9007199254740993');
      expect(repositorio.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empresaId: 20, id: 9007199254740993n },
        }),
      );
      await service.crear(tabla, 20, tabla.ejemplo);
      expect(repositorio.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...tabla.ejemplo, empresaId: 20 } }),
      );
      await service.editar(tabla, 20, '9007199254740993', {});
      expect(repositorio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empresaId: 20, id: 9007199254740993n },
          data: {},
        }),
      );
      // La consulta raw adicional de canales indica que no hay socios relacionados.
      db.$queryRaw
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([]);
      await expect(
        service.eliminar(tabla, 20, '9007199254740993'),
      ).resolves.toEqual({ ok: true });
      expect(repositorio.delete).toHaveBeenCalledWith({
        where: { empresaId: 20, id: 9007199254740993n },
        select: { id: true },
      });
    },
  );

  it('bulk conserva la primera fila y cuenta existentes sin actualizarlos', async () => {
    const { modelos, db, service } = preparar();
    const repositorio = modelos.socioNegocio;
    repositorio.createMany.mockResolvedValue({ count: 1 });
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_ocrd, 20, [
        { CardCode: 'A', CardName: 'Primero' },
        { CardCode: 'A', CardName: 'No sobrescribir' },
        { CardCode: 'B' },
      ]),
    ).resolves.toEqual({
      recibidos: 3,
      insertados: 1,
      existentes: 1,
      duplicadosEnLote: 1,
      omitidos: 2,
    });
    expect(repositorio.createMany).toHaveBeenCalledWith({
      data: [
        { CardCode: 'A', CardName: 'Primero', empresaId: 20 },
        { CardCode: 'B', empresaId: 20 },
      ],
      skipDuplicates: true,
    });
    expect(repositorio.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5000,
      timeout: TIMEOUT_LOTE_SOCIOS_MS,
    });
  });

  it('direcciones: deduplica defaults/NULL y conserva calles distintas', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocioDireccion.createMany.mockResolvedValue({ count: 3 });
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_crd1, 20, [
        { CardCode: 'A' },
        { CardCode: 'A', Address: null, Street: null, AdresType: 'S' },
        { CardCode: 'A', AdresType: null },
        { CardCode: 'A', Street: 'Otra calle' },
      ]),
    ).resolves.toEqual({
      recibidos: 4,
      insertados: 3,
      existentes: 0,
      duplicadosEnLote: 1,
      omitidos: 1,
    });
  });

  it('divide lotes grandes en bloques dentro de una única transacción', async () => {
    const { modelos, db, service } = preparar();
    modelos.socioNegocio.createMany
      .mockResolvedValueOnce({ count: SOCIOS_POR_BLOQUE })
      .mockResolvedValueOnce({ count: 1 });
    const filas = Array.from({ length: SOCIOS_POR_BLOQUE + 1 }, (_, i) => ({
      CardCode: String(i),
    }));
    expect(await service.crear(TABLAS_SOCIOS.tbl_ocrd, 20, filas)).toEqual({
      recibidos: filas.length,
      insertados: filas.length,
      existentes: 0,
      duplicadosEnLote: 0,
      omitidos: 0,
    });
    expect(modelos.socioNegocio.createMany).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    TABLAS_SOCIOS.tbl_jcanal,
    TABLAS_SOCIOS.tbl_jcanales,
    TABLAS_SOCIOS.tbl_jsubcanal,
    TABLAS_SOCIOS.tbl_jsubcanales,
  ])(
    '$nombre: asigna Code por empresa reservando los códigos explícitos del lote',
    async (tabla) => {
      const { modelos, db, service } = preparar();
      const repositorio = modelos[tabla.modelo];
      repositorio.aggregate.mockResolvedValue({ _max: { Code: 8 } });
      repositorio.createMany.mockResolvedValue({ count: 3 });
      await service.crear(tabla, 20, [
        { Name: 'Primero' },
        { Code: 9, Name: 'Explícito' },
        { Name: 'Segundo' },
      ]);
      expect(repositorio.aggregate).toHaveBeenCalledWith({
        where: { empresaId: 20 },
        _max: { Code: true },
      });
      expect(repositorio.createMany).toHaveBeenCalledWith({
        data: [
          { Name: 'Primero', Code: 10, empresaId: 20 },
          { Code: 9, Name: 'Explícito', empresaId: 20 },
          { Name: 'Segundo', Code: 11, empresaId: 20 },
        ],
        skipDuplicates: true,
      });
      const bloqueo = db.$queryRaw.mock.calls[0];
      expect((bloqueo[0] as TemplateStringsArray).join('?')).toContain(
        'WHERE id = ? FOR UPDATE',
      );
      expect(bloqueo[1]).toBe(20);
    },
  );

  it('rechaza empresas ausentes antes de leer o insertar', async () => {
    const { modelos, db, service } = preparar();
    db.empresa.findUnique.mockResolvedValue(null);
    await expect(
      service.listar(TABLAS_SOCIOS.tbl_ocrd, 20, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(modelos.socioNegocio.findMany).not.toHaveBeenCalled();
    db.$queryRaw.mockResolvedValue([]);
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_ocrd, 20, { CardCode: 'A' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(modelos.socioNegocio.create).not.toHaveBeenCalled();
  });

  it('no modifica ni elimina un id de otra empresa', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocio.findFirst.mockResolvedValue(null);
    await expect(
      service.editar(TABLAS_SOCIOS.tbl_ocrd, 20, '1', { CardName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.eliminar(TABLAS_SOCIOS.tbl_ocrd, 20, '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(modelos.socioNegocio.update).not.toHaveBeenCalled();
    expect(modelos.socioNegocio.delete).not.toHaveBeenCalled();
  });

  it('impide eliminar socios con direcciones y cambiar claves de catálogos usados', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocioDireccion.count.mockResolvedValue(1);
    await expect(
      service.eliminar(TABLAS_SOCIOS.tbl_ocrd, 20, '1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(modelos.socioNegocioDireccion.count).toHaveBeenCalledWith({
      where: { empresaId: 20, CardCode: 'C0001' },
    });
    modelos.socioNegocio.count.mockResolvedValue(1);
    await expect(
      service.editar(TABLAS_SOCIOS.tbl_ocrg, 20, '1', { GroupCode: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(modelos.socioNegocio.count).toHaveBeenCalledWith({
      where: { empresaId: 20, GroupCode: 1 },
    });
    expect(modelos.socioNegocioGrupo.update).not.toHaveBeenCalled();
  });

  it('protege canales referenciados mediante texto numérico con ceros iniciales', async () => {
    const { db, modelos, service } = preparar();
    await expect(
      service.eliminar(TABLAS_SOCIOS.tbl_jcanal, 20, '1'),
    ).rejects.toBeInstanceOf(ConflictException);
    const consulta = db.$queryRaw.mock.calls[1][0] as Prisma.Sql;
    expect(consulta.sql).toContain('"U_jCANAL"::numeric');
    expect(consulta.values).toEqual([20, 1]);
    expect(modelos.socioNegocioCanal.delete).not.toHaveBeenCalled();
  });

  it('resuelve relaciones dentro de la empresa, conserva texto y devuelve null para referencias ausentes', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocio.findFirst.mockResolvedValue({
      id: 1n,
      CardCode: 'A',
      GroupCode: 7,
      GroupNum: null,
      ListNum: 3,
      SlpCode: -1,
      AgentCode: 'SUP',
      U_jCANAL: '0001',
      U_jSUBCANAL: 'no numérico',
    });
    modelos.socioNegocioGrupo.findFirst.mockResolvedValue(null);
    const resultado = await service.relaciones(20, '1');
    expect(resultado.tbl_ocrd.U_jCANAL).toBe('0001');
    expect(resultado.tbl_ocrg).toBeNull();
    expect(resultado.tbl_octg).toBeNull();
    expect(resultado.tbl_jsubcanal).toBeNull();
    expect(modelos.socioNegocioCanal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, Code: 1 } }),
    );
    expect(modelos.socioNegocioVendedor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, SlpCode: -1 } }),
    );
    expect(modelos.socioNegocioCanales.findFirst).not.toHaveBeenCalled();
    expect(modelos.socioNegocioSubcanal.findFirst).not.toHaveBeenCalled();
    await service.direcciones(20, '1', { page: 2, limit: 10 });
    expect(modelos.socioNegocioDireccion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 20, CardCode: 'A' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('mapea duplicados a 409 y propaga fallos para revertir el lote', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocio.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_ocrd, 20, { CardCode: 'A' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const fallo = new Error('Fallo de base de datos');
    modelos.socioNegocio.createMany.mockRejectedValue(fallo);
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_ocrd, 20, [{ CardCode: 'A' }]),
    ).rejects.toBe(fallo);
  });

  it('no desborda el int4 al asignar Code', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocioCanal.aggregate.mockResolvedValue({
      _max: { Code: 2147483647 },
    });
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_jcanal, 20, { Name: 'Nuevo' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(modelos.socioNegocioCanal.create).not.toHaveBeenCalled();
  });
});
