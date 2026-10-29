import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ModuloMenu } from './interfaces/plataforma.interface';
import { rolVe } from './utils/visibilidad';

@Injectable()
export class MiPlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  // Menú del usuario: módulos que su empresa habilitó Y que su rol puede ver,
  // con las páginas visibles (todas, o solo las asignadas a su rol).
  // rolIds vacío en la asignación = visible para todos los roles.
  async menu(usuarioId: number): Promise<ModuloMenu[]> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        empresaId: true,
        rolId: true,
        isActive: true,
        esSuperadmin: true,
        rol: { select: { esAdminTi: true } },
      },
    });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }
    if (usuario.rol?.esAdminTi && !usuario.esSuperadmin) return [];

    // Módulos y páginas asignadas no dependen entre sí: van juntos.
    const [habilitados, paginasAsignadas] = await Promise.all([
      this.prisma.empresaModulo.findMany({
        where: { empresaId: usuario.empresaId, modulo: { activo: true } },
        include: {
          modulo: {
            include: {
              paginas: {
                where: { activo: true },
                orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
              },
            },
          },
        },
        orderBy: { modulo: { orden: 'asc' } },
      }),
      // Páginas específicas visibles (cuando el módulo no es "todas las páginas")
      this.prisma.empresaPagina.findMany({
        where: { empresaId: usuario.empresaId },
        select: { paginaId: true, rolIds: true },
      }),
    ]);
    const asignacionPorPagina = new Map(
      paginasAsignadas.map((p) => [p.paginaId, p.rolIds]),
    );

    return (
      habilitados
        .filter((em) => rolVe(em.rolIds, usuario.rolId))
        .map((em) => {
          const paginas = em.modulo.paginas
            .filter((p) => {
              if (em.todasLasPaginas) {
                return true;
              }
              const rolIdsPagina = asignacionPorPagina.get(p.id);
              return (
                rolIdsPagina !== undefined && rolVe(rolIdsPagina, usuario.rolId)
              );
            })
            .map((p) => ({
              id: p.id,
              nombre: p.nombre,
              ruta: p.ruta,
              icono: p.icono,
            }));
          return {
            id: em.modulo.id,
            nombre: em.modulo.nombre,
            ruta: em.modulo.ruta,
            icono: em.modulo.icono,
            paginas,
          };
        })
        // Un módulo sin páginas visibles no aparece en el menú
        .filter((m) => m.paginas.length > 0)
    );
  }
}
