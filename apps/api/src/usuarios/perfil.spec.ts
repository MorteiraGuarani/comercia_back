import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthService } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from './usuarios.service';
import { calcularDvRucPy } from '../common/utils/ruc';
import * as archivos from '../campo/utils/multer-config';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../auth/auth.service', () => ({
  AuthService: class AuthService {},
}));

describe('Mis datos (perfil propio)', () => {
  function preparar() {
    const prisma = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          esSuperadmin: false,
          fotoPerfil: null,
          rol: { descripcion: 'BOFFICE_REPOSITORES' },
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 7 }),
      },
    };
    const service = new UsuariosService(
      prisma as unknown as PrismaService,
      {} as AuthService,
    );
    return { prisma, service };
  }

  it('guarda solo nombre, apellido, correo, RUC y celular, normalizados', async () => {
    const { prisma, service } = preparar();
    await service.actualizarPerfil(7, {
      nombre: 'Ana',
      apellido: 'Rojas',
      correo: 'ana@example.com',
      ruc: `1234567-${calcularDvRucPy('1234567')}`,
      celular: '0981 123456',
      celularPais: 'PY',
    });
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nombre: 'Ana',
        apellido: 'Rojas',
        correo: 'ana@example.com',
        ruc: `1234567-${calcularDvRucPy('1234567')}`,
        celular: '+595981123456',
      },
      select: { id: true },
    });
  });

  it('los roles de campo solo ven sus datos: no editan ni cambian la foto', async () => {
    const { prisma, service } = preparar();
    for (const descripcion of [
      'REPOSITOR',
      'SUPERVISOR_REPOSITORES',
      'TEAMLEADER',
    ]) {
      prisma.usuario.findUnique.mockResolvedValue({
        esSuperadmin: false,
        fotoPerfil: null,
        rol: { descripcion },
      });
      await expect(
        service.actualizarPerfil(7, { nombre: 'Ana' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.quitarFotoPerfil(7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('no deja usar el correo de otra cuenta', async () => {
    const { prisma, service } = preparar();
    prisma.usuario.findFirst.mockResolvedValue({ correo: 'ana@example.com' });
    await expect(
      service.actualizarPerfil(7, { correo: 'ana@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('al subir una foto nueva borra la anterior', async () => {
    const { prisma, service } = preparar();
    jest.spyOn(archivos, 'validarArchivoImagen').mockImplementation(() => {});
    const resolver = jest
      .spyOn(archivos, 'resolverRutaFoto')
      .mockReturnValue('no-existe/vieja.jpg');
    prisma.usuario.findUnique.mockResolvedValue({
      esSuperadmin: false,
      fotoPerfil: 'perfiles/vieja.jpg',
      rol: { descripcion: 'MANAGER VENTAS' },
    });
    await service.guardarFotoPerfil(7, {
      filename: 'nueva.png',
      mimetype: 'image/png',
    } as Express.Multer.File);
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { fotoPerfil: 'perfiles/nueva.png', fotoPerfilMime: 'image/png' },
      select: { id: true },
    });
    expect(resolver).toHaveBeenCalledWith('perfiles/vieja.jpg');
    jest.restoreAllMocks();
  });
});
