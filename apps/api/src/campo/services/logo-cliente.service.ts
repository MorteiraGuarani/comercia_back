import { BadRequestException, Injectable } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoAccesoService } from '../campo-acceso.service';
import {
  directorioLogosClientes,
  validarArchivoImagen,
} from '../utils/multer-config';
import { extensionLogo, leerNombreLogo } from '../utils/nombre-logo';

@Injectable()
export class LogoClienteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  /** Solo quien gestiona clientes sube logos, y quedan a nombre de su empresa. */
  async subir(
    usuarioId: number,
    file?: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No se envió archivo de imagen');
    const usuario = await this.acceso.administrar(usuarioId, 'clientes');
    validarArchivoImagen(file);
    const nombre = `logo_${usuario.empresaId}_${uuidv4()}${extensionLogo(file.mimetype)}`;
    const directorio = directorioLogosClientes();
    mkdirSync(directorio, { recursive: true });
    await writeFile(join(directorio, nombre), file.buffer);
    return { url: `/api/v1/campo/clientes/logos/${nombre}` };
  }

  /** Ruta del logo si pertenece a la empresa de quien lo pide; si no, null. */
  async ruta(empresaId: number, archivo: string): Promise<string | null> {
    const logo = leerNombreLogo(archivo);
    if (!logo) return null;
    if (logo.empresaId !== null) {
      if (logo.empresaId !== empresaId) return null;
    } else {
      // Logos subidos antes de llevar la empresa en el nombre: se reconocen
      // por el cliente que los usa.
      const cliente = await this.prisma.clienteCampo.findFirst({
        where: { empresaId, logoUrl: { endsWith: `/${logo.nombre}` } },
        select: { id: true },
      });
      if (!cliente) return null;
    }
    const persistida = join(directorioLogosClientes(), logo.nombre);
    if (existsSync(persistida)) return persistida;
    const anterior = join(process.cwd(), 'uploads', 'clientes', logo.nombre);
    return existsSync(anterior) ? anterior : null;
  }
}
