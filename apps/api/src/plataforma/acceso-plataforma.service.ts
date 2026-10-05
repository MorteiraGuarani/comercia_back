import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UsuarioConAcceso } from './interfaces/usuario-con-acceso.interface';
import type { AccesoModulos } from './interfaces/acceso-modulos.interface';
import { rolVe } from './utils/visibilidad';
import { EQUIPO_CAMPO_SELECT } from '../campo/utils/equipo-campo';

// Control de acceso del plano de DATOS de un módulo (no solo del menú):
// verifica que la empresa del usuario tenga habilitado el módulo Y que el rol
// del usuario pueda ver el módulo y la página, igual que las reglas que aplica
// el menú. Los endpoints de cada módulo lo llaman en su handler para no caer en
// "autenticado ≠ autorizado" (ver AGENTS.md).
@Injectable()
export class AccesoPlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  // Exige que el usuario pueda acceder a una página concreta (por rutas de
  // módulo y página). Lanza 401 si no está activo, 403 si no tiene acceso.
  async exigirAccesoPagina(
    usuarioId: number,
    moduloRuta: string,
    paginaRuta: string,
  ): Promise<UsuarioConAcceso> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        empresaId: true,
        rolId: true,
        isActive: true,
        rol: {
          select: {
            descripcion: true,
            permisosTareas: true,
            puedeVerSeguimiento: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
    });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }

    const modulo = await this.prisma.modulo.findUnique({
      where: { ruta: moduloRuta },
      select: {
        id: true,
        activo: true,
        paginas: {
          where: { ruta: paginaRuta },
          select: { id: true, activo: true },
        },
      },
    });
    const pagina = modulo?.paginas[0];
    // Mensaje neutro: no revela si el módulo/página existe (AGENTS.md)
    const sinAcceso = new ForbiddenException('No tenés acceso a esta sección');
    if (!modulo || !modulo.activo || !pagina || !pagina.activo) {
      throw sinAcceso;
    }

    const empresaModulo = await this.prisma.empresaModulo.findUnique({
      where: {
        empresaId_moduloId: {
          empresaId: usuario.empresaId,
          moduloId: modulo.id,
        },
      },
      select: { todasLasPaginas: true, rolIds: true },
    });
    if (!empresaModulo || !rolVe(empresaModulo.rolIds, usuario.rolId)) {
      throw sinAcceso;
    }

    // Si el módulo no da "todas las páginas", la página debe estar habilitada
    // para la empresa y visible para el rol del usuario.
    if (!empresaModulo.todasLasPaginas) {
      const empresaPagina = await this.prisma.empresaPagina.findUnique({
        where: {
          empresaId_paginaId: {
            empresaId: usuario.empresaId,
            paginaId: pagina.id,
          },
        },
        select: { rolIds: true },
      });
      if (!empresaPagina || !rolVe(empresaPagina.rolIds, usuario.rolId)) {
        throw sinAcceso;
      }
    }

    return {
      id: usuario.id,
      empresaId: usuario.empresaId,
      rolId: usuario.rolId,
      rolDescripcion: usuario.rol?.descripcion ?? null,
      equipoCampo: usuario.rol?.equipoCampo ?? null,
      permisosTareas: usuario.rol?.permisosTareas ?? [],
      puedeVerSeguimiento: usuario.rol?.puedeVerSeguimiento ?? false,
    };
  }

  // Igual que exigirAccesoPagina, pero acepta varias páginas del módulo: pasa
  // si el usuario puede ver ALGUNA. Para endpoints que sirven a más de una
  // vista (ej. los datos del mapa sirven a "mapa" y a "locales").
  async exigirAccesoAlgunaPagina(
    usuarioId: number,
    moduloRuta: string,
    paginasRutas: string[],
  ): Promise<UsuarioConAcceso> {
    let ultimoError: unknown = new ForbiddenException(
      'No tenés acceso a esta sección',
    );
    for (const paginaRuta of paginasRutas) {
      try {
        return await this.exigirAccesoPagina(usuarioId, moduloRuta, paginaRuta);
      } catch (error) {
        // 401 (usuario inexistente/inactivo) no depende de la página: cortar
        if (error instanceof UnauthorizedException) {
          throw error;
        }
        ultimoError = error;
      }
    }
    throw ultimoError;
  }

  // Variante para una misma funcionalidad expuesta desde más de un módulo
  // de plataforma (Supervisor y Repositor comparten varias vistas).
  async exigirAccesoAlgunaPaginaEnModulos(
    usuarioId: number,
    modulosRutas: string[],
    paginasRutas: string[],
  ): Promise<UsuarioConAcceso> {
    const acceso = await this.exigirAccesosPaginasEnModulos(
      usuarioId,
      modulosRutas,
      paginasRutas,
    );
    return acceso.usuario;
  }

  // Resuelve en una sola consulta qué módulos concretos habilitan al usuario.
  // Operaciones de campo lo usa para distinguir Supervisor de Repositor sin
  // mantener otra tabla de roles paralela a Administración.
  async exigirAccesosPaginasEnModulos(
    usuarioId: number,
    modulosRutas: string[],
    paginasRutas: string[],
  ): Promise<AccesoModulos> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        empresaId: true,
        rolId: true,
        isActive: true,
        rol: {
          select: {
            descripcion: true,
            permisosTareas: true,
            puedeVerSeguimiento: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
    });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }

    const [modulos, paginasAsignadas] = await Promise.all([
      this.prisma.empresaModulo.findMany({
        where: {
          empresaId: usuario.empresaId,
          modulo: { activo: true, ruta: { in: modulosRutas } },
        },
        select: {
          todasLasPaginas: true,
          rolIds: true,
          modulo: {
            select: {
              ruta: true,
              paginas: {
                where: { activo: true, ruta: { in: paginasRutas } },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.empresaPagina.findMany({
        where: {
          empresaId: usuario.empresaId,
          pagina: {
            activo: true,
            ruta: { in: paginasRutas },
            modulo: { activo: true, ruta: { in: modulosRutas } },
          },
        },
        select: { paginaId: true, rolIds: true },
      }),
    ]);
    const rolesPorPagina = new Map(
      paginasAsignadas.map((pagina) => [pagina.paginaId, pagina.rolIds]),
    );

    const rutasConAcceso: string[] = [];
    for (const empresaModulo of modulos) {
      if (!rolVe(empresaModulo.rolIds, usuario.rolId)) continue;
      for (const pagina of empresaModulo.modulo.paginas) {
        if (empresaModulo.todasLasPaginas) {
          rutasConAcceso.push(empresaModulo.modulo.ruta);
          break;
        }
        const rolIds = rolesPorPagina.get(pagina.id);
        if (rolIds !== undefined && rolVe(rolIds, usuario.rolId)) {
          rutasConAcceso.push(empresaModulo.modulo.ruta);
          break;
        }
      }
    }

    if (rutasConAcceso.length > 0) {
      return {
        usuario: {
          id: usuario.id,
          empresaId: usuario.empresaId,
          rolId: usuario.rolId,
          rolDescripcion: usuario.rol?.descripcion ?? null,
          equipoCampo: usuario.rol?.equipoCampo ?? null,
          permisosTareas: usuario.rol?.permisosTareas ?? [],
          puedeVerSeguimiento: usuario.rol?.puedeVerSeguimiento ?? false,
        },
        modulosRutas: [...new Set(rutasConAcceso)],
      };
    }

    throw new ForbiddenException('No tenés acceso a esta sección');
  }
}
