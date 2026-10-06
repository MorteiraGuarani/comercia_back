jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../auth/auth.service', () => ({ AuthService: class {} }));
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { UsuariosService } from './usuarios.service';
import { ListarSuperioresDto } from './dto/listar-superiores.dto';
import { filtrosBusquedaUsuario } from '../common/utils/busqueda-usuario';

const admin = {
  id: 1,
  empresaId: 2,
  esSuperadmin: false,
  isActive: true,
  rol: { descripcion: 'GERENTE' },
};
const superior = {
  id: 11,
  empresaId: 2,
  isActive: true,
  esSuperadmin: false,
  rolId: 5,
  superiorId: null,
};
function crear() {
  const prisma = {
    usuario: {
      findUnique: jest
        .fn<Promise<unknown>, [Prisma.UsuarioFindUniqueArgs]>()
        .mockResolvedValue(admin),
      findMany: jest
        .fn<Promise<unknown[]>, [Prisma.UsuarioFindManyArgs]>()
        .mockResolvedValue([
          { id: 11, nombre: 'Persona', apellido: 'Responsable' },
        ]),
      count: jest.fn().mockResolvedValue(9),
      update: jest.fn(),
    },
    rol: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 2, empresaId: 2, rolId: 5 }),
    },
  };
  const auth = { crearUsuario: jest.fn() };
  return {
    prisma,
    auth,
    servicio: new UsuariosService(prisma as never, auth as never),
  };
}
const query = Object.assign(new ListarSuperioresDto(), {
  empresaId: 2,
  rolId: 2,
  excluirUsuarioId: 20,
  page: 2,
  limit: 7,
  buscar: 'Persona Responsable',
});

describe('Superiores según el organigrama', () => {
  it('busca en toda la empresa por rol padre, con paginación y datos mínimos', async () => {
    const { servicio, prisma } = crear();
    const resultado = await servicio.listarSuperiores(1, query);
    expect(resultado).toEqual({
      items: [{ id: 11, nombre: 'Persona Responsable' }],
      total: 9,
      page: 2,
      limit: 7,
      totalPages: 2,
    });
    const esperado = {
      empresaId: 2,
      rolId: 5,
      isActive: true,
      esSuperadmin: false,
      id: { not: 20 },
      AND: filtrosBusquedaUsuario('Persona Responsable'),
    };
    expect(prisma.usuario.count).toHaveBeenCalledWith({ where: esperado });
    expect(prisma.usuario.findMany).toHaveBeenCalledWith({
      where: esperado,
      select: { id: true, nombre: true, apellido: true },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
      skip: 7,
      take: 7,
    });
  });
  it.each([
    [3, 2],
    [2, 5],
    [9, 7],
    [222, 223],
  ])(
    'respeta el rol %s y su padre %s sin depender del nombre del rol',
    async (rolId, rolPadreId) => {
      const { servicio, prisma } = crear();
      prisma.rol.findUnique.mockResolvedValue({
        id: rolId,
        empresaId: 2,
        rolId: rolPadreId,
      });
      await servicio.listarSuperiores(
        1,
        Object.assign(new ListarSuperioresDto(), { rolId }),
      );
      expect(prisma.usuario.findMany.mock.calls[0][0].where?.rolId).toBe(
        rolPadreId,
      );
    },
  );
  it('un rol raíz no tiene candidatos y no descarga usuarios', async () => {
    const { servicio, prisma } = crear();
    prisma.rol.findUnique.mockResolvedValue({
      id: 5,
      empresaId: 2,
      rolId: null,
    });
    expect((await servicio.listarSuperiores(1, query)).items).toEqual([]);
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
  it('rechaza otra empresa, un rol ajeno y una cuenta sin permiso', async () => {
    const { servicio, prisma } = crear();
    await expect(
      servicio.listarSuperiores(1, { ...query, empresaId: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    prisma.rol.findUnique.mockResolvedValue({ id: 2, empresaId: 3, rolId: 5 });
    await expect(servicio.listarSuperiores(1, query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.usuario.findUnique.mockResolvedValue({
      ...admin,
      rol: { descripcion: 'Impulsador' },
    });
    await expect(servicio.listarSuperiores(1, query)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.usuario.findUnique.mockResolvedValue({ ...admin, isActive: false });
    await expect(servicio.listarSuperiores(1, query)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.usuario.findMany).not.toHaveBeenCalled();
  });
  const alta = {
    nombre: 'Persona',
    apellido: 'Nueva',
    correo: 'persona@example.test',
    nombreLogin: 'persona',
    empresaId: 2,
    ruc: '1234567-8',
    celularPais: 'PY',
    celular: '0981123456',
    password: 'claveprueba',
    rolId: 2,
    superiorId: 11,
  };
  it.each([
    ['otro rol', { ...superior, rolId: 7 }, BadRequestException],
    ['inactivo', { ...superior, isActive: false }, NotFoundException],
    ['otra empresa', { ...superior, empresaId: 3 }, NotFoundException],
    ['superadmin', { ...superior, esSuperadmin: true }, NotFoundException],
  ])(
    'rechaza guardar un superior %s aunque se envíe directamente por API',
    async (_motivo, candidato, error) => {
      const { servicio, prisma, auth } = crear();
      prisma.usuario.findUnique
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(candidato);
      await expect(servicio.crear(1, alta)).rejects.toBeInstanceOf(error);
      expect(auth.crearUsuario).not.toHaveBeenCalled();
    },
  );
  it('impide asignar superior a un rol raíz', async () => {
    const { servicio, prisma, auth } = crear();
    prisma.usuario.findUnique
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce(superior);
    prisma.rol.findUnique.mockResolvedValue({
      id: 2,
      empresaId: 2,
      rolId: null,
    });
    await expect(servicio.crear(1, alta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(auth.crearUsuario).not.toHaveBeenCalled();
  });
  it('conserva la protección contra ciclos al editar', async () => {
    const { servicio, prisma } = crear();
    prisma.usuario.findUnique
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce({
        empresaId: 2,
        rolId: 2,
        superiorId: null,
        esSuperadmin: false,
      })
      .mockResolvedValueOnce({ ...superior, superiorId: 20 });
    await expect(
      servicio.actualizar(1, 20, { superiorId: 11 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});
