import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { CampoAccesoService } from './campo-acceso.service';
import { CatalogoCampoService } from './catalogo-campo.service';
import { CampoController } from './campo.controller';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('uuid', () => ({ v4: () => 'archivo-de-prueba' }));

describe('Alta de clientes desde PDV y rutas', () => {
  let app: INestApplication<Server>;
  const socioNegocio = {
    create: jest.fn(),
  };
  const socioNegocioDireccion = { create: jest.fn() };
  const prisma = {
    usuario: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const acceso = { gestionar: jest.fn() };
  const cliente = { CardCode: '00001', CardName: 'Almacén Central' };

  beforeAll(async () => {
    const catalogo = new CatalogoCampoService(
      prisma as unknown as PrismaService,
      acceso as unknown as CampoAccesoService,
    );
    // Las demás dependencias del controlador no participan en este endpoint.
    const dependencias = Reflect.getMetadata(
      'design:paramtypes',
      CampoController,
    ) as Array<new () => unknown>;
    const module = await Test.createTestingModule({
      controllers: [CampoController],
      providers: [
        ...dependencias.map((provide) => ({
          provide,
          useValue: provide === CatalogoCampoService ? catalogo : {},
        })),
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { verify: () => ({ sub: 13 }) } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.usuario.findUnique.mockResolvedValue({
      isActive: true,
      empresaId: 10,
    });
    acceso.gestionar.mockResolvedValue({
      empresaId: 10,
      rolDescripcion: 'BOFFICE_REPOSITORES',
    });
    prisma.$transaction.mockImplementation(
      (operacion: (tx: unknown) => Promise<unknown>) =>
        operacion({ socioNegocio, socioNegocioDireccion }),
    );
    socioNegocio.create.mockImplementation(
      ({ data }: { data: typeof cliente }) =>
        Promise.resolve({
          CardCode: data.CardCode,
          CardName: data.CardName,
          U_Latitud: null,
          U_Longitud: null,
        }),
    );
    socioNegocioDireccion.create.mockResolvedValue({
      CardCode: cliente.CardCode,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const crear = (datos: object) =>
    request(app.getHttpServer())
      .post('/campo/locales')
      .set('Authorization', 'Bearer prueba')
      .send(datos);

  it('exige sesión antes de crear', async () => {
    await request(app.getHttpServer())
      .post('/campo/locales')
      .send(cliente)
      .expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exige el permiso de locales, aunque tenga otro módulo abierto', async () => {
    acceso.gestionar.mockRejectedValue(
      new ForbiddenException('Sin acceso a PDV y rutas'),
    );
    await crear(cliente).expect(403);
    expect(acceso.gestionar).toHaveBeenCalledWith(13, 'locales');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('crea el OCRD y su dirección en la empresa autorizada conservando los ceros del código', async () => {
    const respuesta = await crear({
      ...cliente,
      CardName: ' Almacén Central ',
      LicTradNum: ' 80012345-6 ',
      Street: ' Calle 123 ',
    }).expect(201);
    expect(acceso.gestionar).toHaveBeenCalledWith(13, 'locales');
    expect(socioNegocio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { empresaId: 10, ...cliente, LicTradNum: '80012345-6' },
        select: {
          CardCode: true,
          CardName: true,
          LicTradNum: true,
          U_Latitud: true,
          U_Longitud: true,
        },
      }),
    );
    expect(socioNegocioDireccion.create).toHaveBeenCalledWith({
      data: {
        empresaId: 10,
        CardCode: '00001',
        Address: null,
        Street: 'Calle 123',
        AdresType: 'S',
      },
      select: { CardCode: true },
    });
    expect(respuesta.body).toEqual({
      id: '00001',
      nombre: 'Almacén Central',
      direccion: 'Calle 123',
      latitud: null,
      longitud: null,
      radioMetros: 100,
      zonaHoraria: 'America/Asuncion',
      ruc: '',
      address: '',
      street: 'Calle 123',
    });
  });

  it('guarda el punto del mapa y la dirección completa al crear', async () => {
    await crear({
      ...cliente,
      Address: 'Itauguá',
      Street: 'Gobernador Irala',
      latitud: -25.3,
      longitud: -57.6,
    }).expect(201);
    expect(socioNegocio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          U_Latitud: '-25.3000000',
          U_Longitud: '-57.6000000',
        }) as unknown,
      }),
    );
    expect(socioNegocioDireccion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Address: 'Itauguá',
          Street: 'Gobernador Irala',
        }) as unknown,
      }),
    );
  });

  it('permite omitir RUC y dirección sin crear una fila vacía en CRD1', async () => {
    await crear(cliente).expect(201);
    expect(socioNegocio.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { empresaId: 10, ...cliente, LicTradNum: null },
      }),
    );
    expect(socioNegocioDireccion.create).not.toHaveBeenCalled();
  });

  it.each([
    { ...cliente, empresaId: 20 },
    { ...cliente, empresa_id: 20 },
    { ...cliente, CardCode: '   ' },
    { ...cliente, CardCode: '1234567890123456' },
    { ...cliente, CardName: '   ' },
    { ...cliente, CardName: 'x'.repeat(201) },
    { ...cliente, LicTradNum: 'x'.repeat(33) },
    { ...cliente, Street: 'x'.repeat(201) },
    { ...cliente, Address: 'x'.repeat(201) },
    { ...cliente, latitud: 91, longitud: 0 },
    { ...cliente, latitud: -25.3 },
  ])('rechaza campos fuera de contrato o inválidos: %j', async (datos) => {
    await crear(datos).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('responde 409 cuando el código ya existe y no crea dirección', async () => {
    socioNegocio.create.mockRejectedValue({ code: 'P2002' });
    const respuesta = await crear(cliente).expect(409);
    expect(respuesta.body).toMatchObject({
      message: 'Ya existe un cliente con ese código en tu empresa',
    });
    expect(socioNegocioDireccion.create).not.toHaveBeenCalled();
  });
});
