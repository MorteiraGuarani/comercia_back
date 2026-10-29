import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CampoAccesoService } from '../campo-acceso.service';
import { ConsultaOrganigramaDto } from '../dto/organigrama.dto';
import type {
  OrganigramaRespuesta,
  PersonaOrganigrama,
} from '../interfaces/organigrama.interface';
import { fechaCampo, relojCampo, ZONA_CAMPO } from '../utils/calendario';
import {
  obtenerEquipoCompleto,
  obtenerSubordinadosActivos,
} from '../utils/autorizacion';
import { alertasOrganigrama } from '../utils/organigrama';

// El organigrama se entrega completo (un árbol no se pagina); con tope.
const LIMITE_ORGANIGRAMA = 2000;

const hora = (fecha: Date) =>
  fecha.toLocaleTimeString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA_CAMPO,
  });

/**
 * Quién está a cargo de quién y qué pasa hoy con cada uno. El superadmin ve
 * toda la empresa (con inactivos); un líder con Presentismo, su cadena.
 */
@Injectable()
export class OrganigramaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  async organigrama(
    usuarioId: number,
    q: ConsultaOrganigramaDto,
  ): Promise<OrganigramaRespuesta> {
    const yo = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { empresaId: true, isActive: true, esSuperadmin: true },
    });
    const superadmin = !!yo?.isActive && yo.esSuperadmin;
    let empresaId: number;
    let raizId: number | null = null;
    let ids: number[] | null = null;
    if (superadmin) empresaId = q.empresaId ?? yo.empresaId;
    else {
      const lider = await this.acceso.gestionar(usuarioId, 'visitas');
      if (q.empresaId !== undefined && q.empresaId !== lider.empresaId)
        throw new ForbiddenException('Sin acceso a esa empresa');
      empresaId = lider.empresaId;
      raizId = lider.id;
      // Una jefatura ve su cadena y además el personal de sus equipos, así se
      // nota quién todavía no depende de ella.
      ids = [
        ...new Set([
          lider.id,
          ...(await obtenerSubordinadosActivos(
            this.prisma,
            lider.id,
            empresaId,
          )),
          ...(lider.gestor
            ? await obtenerEquipoCompleto(this.prisma, lider.id)
            : []),
        ]),
      ];
    }
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no disponible');
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        esSuperadmin: false,
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        nombreLogin: true,
        celular: true,
        correo: true,
        isActive: true,
        superiorId: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: { id: true, nombre: true, tipo: true } },
            gestionaTodosEquipos: true,
            _count: { select: { equiposGestion: true } },
          },
        },
      },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
      take: LIMITE_ORGANIGRAMA + 1,
    });
    if (usuarios.length > LIMITE_ORGANIGRAMA)
      throw new PayloadTooLargeException(
        'La empresa supera el máximo de personas que se pueden mostrar',
      );

    const hoy = relojCampo().fecha;
    const fecha = fechaCampo(hoy);
    const idsUsuarios = usuarios.map((u) => u.id);
    const [visitas, asignaciones] = await Promise.all([
      this.prisma.visitaCampo.findMany({
        where: { empresaId, usuarioId: { in: idsUsuarios }, fecha },
        select: { usuarioId: true, entrada: true, salida: true },
        orderBy: { entrada: 'asc' },
        take: idsUsuarios.length * 50,
      }),
      this.prisma.asignacionCampo.groupBy({
        by: ['usuarioId'],
        where: {
          empresaId,
          usuarioId: { in: idsUsuarios },
          activo: true,
          fechaDesde: { lte: fecha },
          OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
        },
        orderBy: { usuarioId: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const locales = new Map(
      asignaciones.map((a) => [a.usuarioId, a._count._all]),
    );
    // En la vista de un líder, su propio superior queda fuera.
    const superiorDe = (u: (typeof usuarios)[number]) =>
      u.id === raizId ? null : u.superiorId;
    const alertas = alertasOrganigrama(
      usuarios.map((u) => ({
        id: u.id,
        activo: u.isActive,
        superiorId: superiorDe(u),
        tieneRol: !!u.rol,
        equipoId: u.rol?.equipoCampo?.id ?? null,
        gestor: !!u.rol?.gestionaTodosEquipos || !!u.rol?._count.equiposGestion,
      })),
      raizId,
    );
    const personas = usuarios.map((u): PersonaOrganigrama => {
      const propias = visitas.filter((v) => v.usuarioId === u.id);
      const equipo = u.rol?.equipoCampo;
      return {
        id: u.id,
        nombre: `${u.nombre} ${u.apellido}`.trim(),
        iniciales: `${u.nombre[0] ?? ''}${u.apellido[0] ?? ''}`.toUpperCase(),
        usuario: superadmin ? u.nombreLogin : null,
        celular: u.celular || null,
        correo: u.correo,
        activo: u.isActive,
        superiorId: superiorDe(u),
        rol: u.rol?.descripcion ?? null,
        equipo: equipo ? { nombre: equipo.nombre, tipo: equipo.tipo } : null,
        hoy: {
          locales: locales.get(u.id) ?? 0,
          visitas: propias.length,
          entrada: propias[0] ? hora(propias[0].entrada) : null,
          enCurso: propias.some((v) => v.salida === null),
        },
        alertas: alertas.get(u.id) ?? [],
      };
    });
    return { empresa, hoy, raizId, personas };
  }
}
