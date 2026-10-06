jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosController } from './usuarios.controller';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { UsuariosService } from './usuarios.service';
import type { Prisma } from '../../generated/prisma/client';

describe('HTTP: selector de superiores', () => {
  let app: INestApplication<Server>;
  const admin = {
    id: 1,
    empresaId: 2,
    isActive: true,
    esSuperadmin: false,
    rol: { descripcion: 'GERENTE' },
  };
  const prisma = {
    usuario: {
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 12, nombre: 'Persona', apellido: 'Responsable' },
        ]),
    },
    rol: { findUnique: jest.fn() },
  };
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [UsuariosController, AdminUsuariosController],
      providers: [
        UsuariosService,
        JwtAuthGuard,
        SuperadminGuard,
        { provide: AuthService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue({ sub: 1 }) },
        },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(admin);
    prisma.rol.findUnique.mockResolvedValue({ empresaId: 2, rolId: 5 });
  });
  it('devuelve solo IDs y nombres con el filtro de empresa y rol padre', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2&buscar=Persona&page=2&limit=7')
      .auth('prueba', { type: 'bearer' })
      .expect(200);
    expect(respuesta.body).toMatchObject({
      items: [{ id: 12, nombre: 'Persona Responsable' }],
      page: 2,
      limit: 7,
    });
    const consulta = prisma.usuario.findMany.mock.calls[0] as [
      Prisma.UsuarioFindManyArgs,
    ];
    expect(consulta[0].where).toMatchObject({
      empresaId: 2,
      rolId: 5,
      isActive: true,
      esSuperadmin: false,
    });
    expect(consulta[0]).toMatchObject({ skip: 7, take: 7 });
  });
  it('exige sesión y un rol válido, con paginación acotada', async () => {
    await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2')
      .expect(401);
    for (const consulta of [
      '',
      '?rolId=0',
      '?rolId=2&limit=51',
      '?rolId=2&excluirUsuarioId=-1',
    ])
      await request(app.getHttpServer())
        .get('/usuarios/superiores' + consulta)
        .auth('prueba', { type: 'bearer' })
        .expect(400);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
  it('no permite consultar otra empresa ni un rol ajeno', async () => {
    await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2&empresaId=3')
      .auth('prueba', { type: 'bearer' })
      .expect(403);
    prisma.rol.findUnique.mockResolvedValue({ empresaId: 3, rolId: 5 });
    await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2')
      .auth('prueba', { type: 'bearer' })
      .expect(404);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
  it('bloquea un colaborador sin permiso y una cuenta inactiva', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      ...admin,
      rol: { descripcion: 'Impulsador' },
    });
    await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2')
      .auth('prueba', { type: 'bearer' })
      .expect(403);
    prisma.usuario.findUnique.mockResolvedValue({ ...admin, isActive: false });
    await request(app.getHttpServer())
      .get('/usuarios/superiores?rolId=2')
      .auth('prueba', { type: 'bearer' })
      .expect(401);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
  it('también protege el endpoint del ABM superadmin', async () => {
    await request(app.getHttpServer())
      .get('/admin/usuarios/superiores?rolId=2')
      .auth('prueba', { type: 'bearer' })
      .expect(403);
    prisma.usuario.findUnique.mockResolvedValue({
      ...admin,
      esSuperadmin: true,
    });
    await request(app.getHttpServer())
      .get('/admin/usuarios/superiores?rolId=2&empresaId=2')
      .auth('prueba', { type: 'bearer' })
      .expect(200);
  });
});
