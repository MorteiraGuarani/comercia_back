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
  it('OSCN lista por CardCode y exige selector para modificar si hay varias filas', async () => {
    const { modelos, service } = preparar();
    const tabla = TABLAS_SOCIOS.tbl_oscn;
    const repo = modelos.codigoArticuloSocio;
    const primera = {
      id: 11n,
      CardCode: '0001',
      ItemCode: 'A',
      Substitute: 'ALT1',
    };
    const segunda = { ...primera, id: 12n, ItemCode: 'B', Substitute: 'ALT2' };
    repo.findMany.mockResolvedValue([primera, segunda]);
    await service.obtener(tabla, 20, '0001', { page: 1, limit: 7 });
    expect(repo.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { empresaId: 20, CardCode: '0001' },
        skip: 0,
        take: 7,
      }),
    );
    await expect(
      service.editar(tabla, 20, '0001', { Descriptio: 'Nuevo' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.eliminar(tabla, 20, '0001')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
    const selector = JSON.stringify({ ItemCode: 'B', Substitute: 'ALT2' });
    repo.findMany.mockResolvedValue([segunda]);
    await service.editar(tabla, 20, '0001', { Descriptio: 'Nuevo' }, selector);
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 12n,
          empresaId: 20,
          CardCode: '0001',
          ItemCode: 'B',
          Substitute: 'ALT2',
        },
      }),
    );
    await service.eliminar(tabla, 20, '0001', selector);
    expect(repo.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 12n,
          empresaId: 20,
          CardCode: '0001',
          ItemCode: 'B',
          Substitute: 'ALT2',
        },
      }),
    );
    await expect(
      service.eliminar(tabla, 20, '0001', '{"ItemCode":"B"}'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([
    {
      tabla: TABLAS_SOCIOS.tbl_ocrg,
      modelo: 'socioNegocioGrupo',
      clave: 'GroupCode',
      valor: 202,
      campo: 'GroupName',
    },
    {
      tabla: TABLAS_SOCIOS.tbl_octg,
      modelo: 'socioNegocioCondicionPago',
      clave: 'GroupNumber',
      valor: -1,
      campo: 'PaymentTermsGroupName',
    },
  ] as const)(
    'consulta, edita y elimina $tabla.nombre por $clave y empresa, no por id',
    async ({ tabla, modelo, clave, valor, campo }) => {
      const { modelos, service } = preparar();
      const repo = modelos[modelo];
      const fila = {
        id: 987654n,
        empresaId: 20,
        [clave]: valor,
        [campo]: 'Anterior',
      };
      repo.findFirst.mockResolvedValue(fila);
      repo.update.mockResolvedValue({ ...fila, [campo]: 'Nuevo' });
      await service.obtener(tabla, 20, valor);
      expect(repo.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { empresaId: 20, [clave]: valor } }),
      );
      await service.editar(tabla, 20, valor, { [campo]: 'Nuevo' });
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 987654n, empresaId: 20, [clave]: valor },
        }),
      );
      await service.eliminar(tabla, 20, valor);
      expect(repo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 987654n, empresaId: 20, [clave]: valor },
        }),
      );
      repo.findFirst.mockResolvedValue(null);
      await expect(service.obtener(tabla, 21, valor)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { empresaId: 21, [clave]: valor } }),
      );
    },
  );
  it('no elige una dirección arbitraria y selecciona por clave original incluyendo NULL', async () => {
    const { modelos, service } = preparar();
    const tabla = TABLAS_SOCIOS.tbl_crd1;
    const primera = {
      id: 11n,
      CardCode: '0001',
      Address: null,
      Street: 'null',
      AdresType: 'S',
    };
    const segunda = { ...primera, id: 12n, Street: 'Otra calle' };
    modelos.socioNegocioDireccion.findMany.mockResolvedValue([
      primera,
      segunda,
    ]);
    await expect(
      service.editar(tabla, 20, '0001', { Street: 'Nueva' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.eliminar(tabla, 20, '0001')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(modelos.socioNegocioDireccion.update).not.toHaveBeenCalled();
    expect(modelos.socioNegocioDireccion.delete).not.toHaveBeenCalled();
    modelos.socioNegocioDireccion.findMany.mockResolvedValue([primera]);
    const selector = JSON.stringify({
      Address: null,
      Street: 'null',
      AdresType: 'S',
    });
    await service.editar(tabla, 20, '0001', { Street: 'Nueva' }, selector);
    expect(modelos.socioNegocioDireccion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 20,
          id: 11n,
          CardCode: '0001',
          Address: null,
          Street: 'null',
          AdresType: 'S',
        },
        data: { Street: 'Nueva' },
      }),
    );
    await service.eliminar(tabla, 20, '0001', selector);
    expect(modelos.socioNegocioDireccion.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 20,
          id: 11n,
          CardCode: '0001',
          Address: null,
          Street: 'null',
          AdresType: 'S',
        },
      }),
    );
    modelos.socioNegocioDireccion.findMany.mockResolvedValue([]);
    await expect(
      service.eliminar(tabla, 20, 'OTRO', selector),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('tbl_ocrd: no borra un socio usado como local de campo', async () => {
    const { modelos, db, service } = preparar();
    const fila = await modelos.socioNegocio.findFirst({});
    modelos.socioNegocio.findFirst
      .mockResolvedValueOnce(fila)
      .mockResolvedValueOnce({ _count: { asignaciones: 1 } } as never);
    db.$queryRaw.mockResolvedValueOnce([{ id: 20 }]);
    await expect(
      service.eliminar(TABLAS_SOCIOS.tbl_ocrd, 20, '000123'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(modelos.socioNegocio.delete).not.toHaveBeenCalled();
  });

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
      const valor =
        tabla.nombre === 'tbl_ocrd' ||
        tabla.nombre === 'tbl_crd1' ||
        tabla.nombre === 'tbl_oscn' ||
        tabla.nombre === 'tbl_oagp'
          ? '000123'
          : tabla.identidad ||
              tabla.nombre === 'tbl_opln' ||
              tabla.nombre === 'tbl_oslp' ||
              tabla.nombre === 'tbl_ocrg' ||
              tabla.nombre === 'tbl_octg' ||
              tabla.nombre === 'tbl_oitb' ||
              tabla.nombre === 'tbl_omrc'
            ? 7
            : '9007199254740993';
      const referencia =
        tabla.nombre === 'tbl_ocrd' ||
        tabla.nombre === 'tbl_crd1' ||
        tabla.nombre === 'tbl_oscn'
          ? { CardCode: valor }
          : tabla.nombre === 'tbl_oagp'
            ? { AgentCode: valor }
            : tabla.nombre === 'tbl_ocrg'
              ? { GroupCode: 7 }
              : tabla.nombre === 'tbl_octg'
                ? { GroupNumber: 7 }
                : tabla.nombre === 'tbl_oitb'
                  ? { Number: 7 }
                  : tabla.nombre === 'tbl_omrc'
                    ? { FirmCode: 7 }
                    : tabla.nombre === 'tbl_oslp'
                      ? { SlpCode: 7 }
                      : tabla.nombre === 'tbl_opln'
                        ? { ListNum: 7 }
                        : tabla.identidad
                          ? { Code: 7 }
                          : { id: 9007199254740993n };
      await service.obtener(tabla, 20, valor);
      const lectura =
        tabla.nombre === 'tbl_crd1' || tabla.nombre === 'tbl_oscn'
          ? repositorio.findMany
          : repositorio.findFirst;
      expect(lectura).toHaveBeenCalledWith(
        expect.objectContaining({ where: { empresaId: 20, ...referencia } }),
      );
      await service.crear(tabla, 20, tabla.ejemplo);
      expect(repositorio.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...tabla.ejemplo, empresaId: 20 } }),
      );
      await service.editar(tabla, 20, valor, {});
      expect(repositorio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empresaId: 20, id: 9007199254740993n, ...referencia },
          data: {},
        }),
      );
      if (tabla.nombre === 'tbl_ocrd') {
        // Sin operación de campo asociada: el borrado sigue permitido.
        const fila = await repositorio.findFirst({});
        repositorio.findFirst
          .mockResolvedValueOnce(fila)
          .mockResolvedValueOnce({ _count: {} } as never);
      }
      // La consulta raw adicional de canales indica que no hay socios relacionados.
      db.$queryRaw
        .mockResolvedValueOnce([{ id: 20 }])
        .mockResolvedValueOnce([]);
      await expect(service.eliminar(tabla, 20, valor)).resolves.toEqual({
        ok: true,
      });
      expect(repositorio.delete).toHaveBeenCalledWith({
        where: { empresaId: 20, id: 9007199254740993n, ...referencia },
        select: { id: true },
      });
    },
  );

  it('tbl_opln usa ListNum y empresa para consultar, editar y eliminar, sin buscar por id', async () => {
    const { modelos, service } = preparar();
    const tabla = TABLAS_SOCIOS.tbl_opln;
    const repositorio = modelos.socioNegocioListaPrecio;
    const fila = { id: 7n, empresaId: 20, ListNum: 42, ListName: 'Lista' };
    repositorio.findFirst.mockResolvedValue(fila);

    expect(await service.obtener(tabla, 20, 42)).toMatchObject({
      id: '7',
      ListNum: 42,
    });
    expect(repositorio.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { empresaId: 20, ListNum: 42 } }),
    );
    await service.editar(tabla, 20, 42, { ListName: 'Actualizada' });
    expect(repositorio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7n, empresaId: 20, ListNum: 42 },
        data: { ListName: 'Actualizada' },
      }),
    );
    await service.eliminar(tabla, 20, 42);
    expect(repositorio.delete).toHaveBeenCalledWith({
      where: { id: 7n, empresaId: 20, ListNum: 42 },
      select: { id: true },
    });
    expect(modelos.socioNegocio.count).toHaveBeenCalledWith({
      where: { empresaId: 20, ListNum: 42 },
    });

    repositorio.findFirst.mockResolvedValue(null);
    await expect(service.obtener(tabla, 20, 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repositorio.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { empresaId: 20, ListNum: 7 } }),
    );
    await expect(service.obtener(tabla, 21, 42)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repositorio.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { empresaId: 21, ListNum: 42 } }),
    );
    await expect(service.obtener(tabla, 20, '1e3')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('tbl_opln protege el ListNum usado por socios al cambiarlo o eliminarlo', async () => {
    const { modelos, service } = preparar();
    const fila = { id: 7n, empresaId: 20, ListNum: 42, ListName: 'Lista' };
    modelos.socioNegocioListaPrecio.findFirst.mockResolvedValue(fila);
    modelos.socioNegocio.count.mockResolvedValue(1);
    await expect(
      service.editar(TABLAS_SOCIOS.tbl_opln, 20, 42, { ListNum: 43 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.eliminar(TABLAS_SOCIOS.tbl_opln, 20, 42),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(modelos.socioNegocio.count).toHaveBeenCalledWith({
      where: { empresaId: 20, ListNum: 42 },
    });
    expect(modelos.socioNegocioListaPrecio.update).not.toHaveBeenCalled();
    expect(modelos.socioNegocioListaPrecio.delete).not.toHaveBeenCalled();
  });

  it.each([
    {
      tabla: TABLAS_SOCIOS.tbl_oslp,
      campo: 'SlpCode',
      codigo: 42,
      cambio: { SlpName: 'Actualizado' },
    },
    {
      tabla: TABLAS_SOCIOS.tbl_oagp,
      campo: 'AgentCode',
      codigo: '00042',
      cambio: { AgentName: 'Actualizado' },
    },
  ])(
    '$tabla.nombre usa $campo y empresa, sin buscar por id',
    async ({ tabla, campo, codigo, cambio }) => {
      const { modelos, service } = preparar();
      const repositorio = modelos[tabla.modelo];
      const fila = { id: 7n, empresaId: 20, [campo]: codigo };
      repositorio.findFirst.mockResolvedValue(fila);
      expect(await service.obtener(tabla, 20, codigo)).toMatchObject({
        id: '7',
        [campo]: codigo,
      });
      expect(repositorio.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { empresaId: 20, [campo]: codigo } }),
      );
      await service.editar(tabla, 20, codigo, cambio);
      expect(repositorio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7n, empresaId: 20, [campo]: codigo },
          data: cambio,
        }),
      );
      await service.eliminar(tabla, 20, codigo);
      expect(repositorio.delete).toHaveBeenCalledWith({
        where: { id: 7n, empresaId: 20, [campo]: codigo },
        select: { id: true },
      });
      expect(modelos.socioNegocio.count).toHaveBeenCalledWith({
        where: { empresaId: 20, [campo]: codigo },
      });
      repositorio.findFirst.mockResolvedValue(null);
      await expect(service.obtener(tabla, 20, '7')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repositorio.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { empresaId: 20, [campo]: campo === 'SlpCode' ? 7 : '7' },
        }),
      );
      await expect(service.obtener(tabla, 21, codigo)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repositorio.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { empresaId: 21, [campo]: codigo } }),
      );
    },
  );

  it.each([
    { tabla: TABLAS_SOCIOS.tbl_oslp, campo: 'SlpCode', codigo: 42, nuevo: 43 },
    {
      tabla: TABLAS_SOCIOS.tbl_oagp,
      campo: 'AgentCode',
      codigo: '00042',
      nuevo: '00043',
    },
  ])(
    '$tabla.nombre protege $campo usado por socios',
    async ({ tabla, campo, codigo, nuevo }) => {
      const { modelos, service } = preparar();
      const repositorio = modelos[tabla.modelo];
      repositorio.findFirst.mockResolvedValue({
        id: 7n,
        empresaId: 20,
        [campo]: codigo,
      });
      modelos.socioNegocio.count.mockResolvedValue(1);
      await expect(
        service.editar(tabla, 20, codigo, { [campo]: nuevo }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(service.eliminar(tabla, 20, codigo)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(modelos.socioNegocio.count).toHaveBeenCalledWith({
        where: { empresaId: 20, [campo]: codigo },
      });
      expect(repositorio.update).not.toHaveBeenCalled();
      expect(repositorio.delete).not.toHaveBeenCalled();
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
      invalidas: 0,
      filasInvalidas: [],
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
      invalidas: 0,
      filasInvalidas: [],
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
      invalidas: 0,
      filasInvalidas: [],
    });
    expect(modelos.socioNegocio.createMany).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([TABLAS_SOCIOS.tbl_jcanales, TABLAS_SOCIOS.tbl_jsubcanales])(
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

  it('no modifica ni elimina un CardCode de otra empresa', async () => {
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
      service.eliminar(TABLAS_SOCIOS.tbl_jcanales, 20, '1'),
    ).rejects.toBeInstanceOf(ConflictException);
    const consulta = db.$queryRaw.mock.calls[1][0] as Prisma.Sql;
    expect(consulta.sql).toContain('"U_jCANAL"::numeric');
    expect(consulta.values).toEqual([20, 1]);
    expect(modelos.socioNegocioCanales.delete).not.toHaveBeenCalled();
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
    const resultado = await service.relaciones(20, 'A');
    expect(modelos.socioNegocio.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, CardCode: 'A' } }),
    );
    expect(resultado.tbl_ocrd.U_jCANAL).toBe('0001');
    expect(resultado.tbl_ocrg).toBeNull();
    expect(resultado.tbl_octg).toBeNull();
    expect(resultado.tbl_jsubcanales).toBeNull();
    expect(modelos.socioNegocioCanales.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, Code: 1 } }),
    );
    expect(modelos.socioNegocioVendedor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, SlpCode: -1 } }),
    );
    expect(modelos.socioNegocioSubcanales.findFirst).not.toHaveBeenCalled();
    await service.direcciones(20, 'A', { page: 2, limit: 10 });
    expect(modelos.socioNegocioDireccion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 20, CardCode: 'A' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('resuelve la condicion de pago por GroupNumber dentro de la empresa', async () => {
    const { modelos, service } = preparar();
    modelos.socioNegocio.findFirst.mockResolvedValue({ id: 1n, CardCode: 'A', GroupNum: 7 });
    modelos.socioNegocioCondicionPago.findFirst.mockResolvedValue({ id: 2n, GroupNumber: 7, PaymentTermsGroupName: 'Contado', PriceListNo: 3 });
    const resultado = await service.relaciones(20, 'A');
    expect(modelos.socioNegocioCondicionPago.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 20, GroupNumber: 7 } }),
    );
    expect(resultado.tbl_octg).toMatchObject({ GroupNumber: 7, PaymentTermsGroupName: 'Contado', PriceListNo: 3 });
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
    modelos.socioNegocioCanales.aggregate.mockResolvedValue({
      _max: { Code: 2147483647 },
    });
    await expect(
      service.crear(TABLAS_SOCIOS.tbl_jcanales, 20, { Name: 'Nuevo' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(modelos.socioNegocioCanales.create).not.toHaveBeenCalled();
  });
});
