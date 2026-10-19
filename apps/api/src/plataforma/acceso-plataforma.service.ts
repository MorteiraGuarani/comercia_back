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
// Cada pantalla pide varios datos y cada pedido repite este control. El
// resultado (permitido o 403) se recuerda unos segundos por usuario: un cambio
// de permisos tarda como máximo eso en aplicarse. Un usuario desactivado queda
// afuera al instante igual, porque JwtAuthGuard lo comprueba en cada pedido.
const DURACION_CACHE_MS = 15_000;
const MAX_ENTRADAS_CACHE = 5_000;

@Injectable()
export class AccesoPlataformaService {
  private readonly cache = new Map<
    string,
    { vence: number; resultado: Promise<unknown> }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /** Vacía lo recordado (tests o cambios de permisos que no deben esperar). */
  limpiarCache(): void {
    this.cache.clear();
  }

  private recordar<T>(clave: string, calcular: () => Promise<T>): Promise<T> {
    const ahora = Date.now();
    const guardado = this.cache.get(clave);
    if (guardado && guardado.vence > ahora) {
      return guardado.resultado as Promise<T>;
    }
    if (this.cache.size >= MAX_ENTRADAS_CACHE) {
      for (const [k, v] of this.cache)
        if (v.vence <= ahora) this.cache.delete(k);
      if (this.cache.size >= MAX_ENTRADAS_CACHE) this.cache.clear();
    }
    const resultado = calcular();
    this.cache.set(clave, { vence: ahora + DURACION_CACHE_MS, resultado });
    // Se recuerda el 403; un 401 o un error de base se vuelve a consultar.
    resultado.catch((error: unknown) => {
      if (
        !(error instanceof ForbiddenException) &&
        this.cache.get(clave)?.resultado === resultado
      )
        this.cache.delete(clave);
    });
    return resultado;
  }

  // Exige que el usuario pueda acceder a una página concreta (por rutas de
  // módulo y página). Lanza 401 si no está activo, 403 si no tiene acceso.
  exigirAccesoPagina(
    usuarioId: number,
    moduloRuta: string,
    paginaRuta: string,
  ): Promise<UsuarioConAcceso> {
    return this.recordar(`p|${usuarioId}|${moduloRuta}|${paginaRuta}`, () =>
      this.calcularAccesoPagina(usuarioId, moduloRuta, paginaRuta),
    );
  }

  private async calcularAccesoPagina(
    usuarioId: number,
    moduloRuta: string,
    paginaRuta: string,
  ): Promise<UsuarioConAcceso> {
    // Usuario y módulo no dependen entre sí: van juntos.
    const [usuario, modulo] = await Promise.all([
      this.prisma.usuario.findUnique({
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
      }),
      this.prisma.modulo.findUnique({
        where: { ruta: moduloRuta },
        select: {
          id: true,
          activo: true,
          paginas: {
            where: { ruta: paginaRuta },
            select: { id: true, activo: true },
          },
        },
      }),
    ]);
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }
    const pagina = modulo?.paginas[0];
    // Mensaje neutro: no revela si el módulo/página existe (AGENTS.md)
    const sinAcceso = new ForbiddenException('No tenés acceso a esta sección');
    if (!modulo || !modulo.activo || !pagina || !pagina.activo) {
      throw sinAcceso;
    }

    // La asignación de la página se pide junto con la del módulo aunque
    // solo se use si el módulo no da "todas las páginas": ahorra una espera.
    const [empresaModulo, empresaPagina] = await Promise.all([
      this.prisma.empresaModulo.findUnique({
        where: {
          empresaId_moduloId: {
            empresaId: usuario.empresaId,
            moduloId: modulo.id,
          },
        },
        select: { todasLasPaginas: true, rolIds: true },
      }),
      this.prisma.empresaPagina.findUnique({
        where: {
          empresaId_paginaId: {
            empresaId: usuario.empresaId,
            paginaId: pagina.id,
          },
        },
        select: { rolIds: true },
      }),
    ]);
    if (!empresaModulo || !rolVe(empresaModulo.rolIds, usuario.rolId)) {
      throw sinAcceso;
    }

    // Si el módulo no da "todas las páginas", la página debe estar habilitada
    // para la empresa y visible para el rol del usuario.
    if (
      !empresaModulo.todasLasPaginas &&
      (!empresaPagina || !rolVe(empresaPagina.rolIds, usuario.rolId))
    ) {
      throw sinAcceso;
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
  exigirAccesosPaginasEnModulos(
    usuarioId: number,
    modulosRutas: string[],
    paginasRutas: string[],
  ): Promise<AccesoModulos> {
    return this.recordar(
      `m|${usuarioId}|${modulosRutas.join(',')}|${paginasRutas.join(',')}`,
      () =>
        this.calcularAccesosEnModulos(usuarioId, modulosRutas, paginasRutas),
    );
  }

  private async calcularAccesosEnModulos(
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
