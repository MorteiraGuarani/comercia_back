import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampoAccesoService } from '../campo/campo-acceso.service';
import { obtenerEquipoCompleto } from '../campo/utils/autorizacion';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { aLocalCampo, LOCAL_OCRD_SELECT } from '../campo/utils/local-ocrd';
import { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import type {
  ConsultaRecorridoDto,
  ConsultaUbicacionesDto,
  LotePingsDto,
} from './dto/ubicacion.dto';
import type { EquipoEnVivo } from './interfaces/equipo-en-vivo.interface';
import type { PuntoUcheck } from './interfaces/punto-ucheck.interface';
import {
  ADELANTO_MAXIMO_PING_MS,
  ANTIGUEDAD_MAXIMA_PING_MS,
  INTERVALO_PING_SEGUNDOS,
  LIMITE_PERSONAS_EN_VIVO,
  PAGINA_UBICACIONES,
} from './ubicaciones.constants';
import { enJornada } from './utils/jornada';
import { calcularRecorrido } from './utils/recorrido';

const DIA_MS = 24 * 60 * 60_000;
// Ucheck acepta hasta 200 personas por consulta de últimas posiciones.
const PERSONAS_POR_CONSULTA = 200;

type Identidad = {
  id: number;
  correo: string;
  identidadUcheck: { ucheckUsuarioId: number } | null;
};

const IDENTIDAD_SELECT = {
  id: true,
  correo: true,
  identidadUcheck: { select: { ucheckUsuarioId: true } },
} as const;

// Fecha del día de campo a la que pertenece un momento (zona del equipo).
const diaDe = (t: Date) => relojCampo(t).fecha;

const aPunto = (p: PuntoUcheck) => ({
  latitud: p.latitud,
  longitud: p.longitud,
  precisionMetros: p.precisionMetros ?? 0,
  velocidadMps: p.velocidad ?? null,
  rumboGrados: p.rumbo ?? null,
  capturadaEn: new Date(p.capturadaEn),
});

/**
 * Posición del equipo de campo durante la jornada. Los pings se guardan en
 * Ucheck (la fuente); acá solo se reenvían y se consultan con GET. Los ven el
 * superadmin (toda la empresa) y cada líder (su cadena, igual que Presentismo).
 */
@Injectable()
export class UbicacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
    private readonly ucheck: UcheckClienteService,
  ) {}

  private visitasDe(u: { id: number; empresaId: number }, fechas: string[]) {
    return this.prisma.visitaCampo.findMany({
      where: {
        empresaId: u.empresaId,
        usuarioId: u.id,
        fecha: { in: fechas.map(fechaCampo) },
      },
      select: { fecha: true, entrada: true, salida: true },
      take: 500,
    });
  }

  async estado(usuarioId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    const ahora = new Date();
    const visitas = await this.visitasDe(u, [diaDe(ahora)]);
    return {
      activa: enJornada(ahora, visitas),
      intervaloSegundos: INTERVALO_PING_SEGUNDOS,
    };
  }

  /** Reenvía a Ucheck lo tomado durante la jornada; Ucheck no duplica. */
  async registrar(usuarioId: number, dto: LotePingsDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const ahora = new Date();
    const pings = dto.pings
      .map((p) => ({ ...p, t: new Date(p.capturadaEn) }))
      .filter(
        ({ t }) =>
          t.getTime() <= ahora.getTime() + ADELANTO_MAXIMO_PING_MS &&
          t.getTime() >= ahora.getTime() - ANTIGUEDAD_MAXIMA_PING_MS,
      );
    const fechas = new Set([diaDe(ahora), ...pings.map(({ t }) => diaDe(t))]);
    const visitas = await this.visitasDe(u, [...fechas]);
    const enRuta = pings.filter(({ t }) => enJornada(t, visitas));
    let guardados = 0;
    if (enRuta.length) {
      const yo = await this.prisma.usuario.findUniqueOrThrow({
        where: { id: u.id },
        select: IDENTIDAD_SELECT,
      });
      ({ guardados } = await this.ucheck.pedir<{ guardados: number }>(
        '/comercia-integracion/ubicaciones',
        {
          method: 'POST',
          espera: 8000,
          body: {
            correo: yo.correo,
            ucheckUsuarioId: yo.identidadUcheck?.ucheckUsuarioId,
            puntos: enRuta.map((p) => ({
              latitud: p.latitud,
              longitud: p.longitud,
              precisionMetros: p.precisionMetros,
              velocidad: p.velocidadMps ?? undefined,
              rumbo: p.rumboGrados ?? undefined,
              capturadaEn: p.t.toISOString(),
            })),
          },
        },
      ));
    }
    return {
      guardados,
      descartados: dto.pings.length - guardados,
      activa: enJornada(ahora, visitas),
    };
  }

  // Superadmin: toda la empresa elegida. Líder con la página: su cadena del
  // mismo equipo operativo, sin incluirse (igual que Presentismo).
  private async alcance(usuarioId: number, empresaIdPedida?: number) {
    const yo = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { empresaId: true, isActive: true, esSuperadmin: true },
    });
    if (yo?.isActive && yo.esSuperadmin)
      return { empresaId: empresaIdPedida ?? yo.empresaId, ids: null };
    const lider = await this.acceso.gestionar(usuarioId, PAGINA_UBICACIONES);
    if (empresaIdPedida !== undefined && empresaIdPedida !== lider.empresaId)
      throw new ForbiddenException('Sin acceso a esa empresa');
    const ids = (await obtenerEquipoCompleto(this.prisma, lider.id)).filter(
      (id) => id !== lider.id,
    );
    return { empresaId: lider.empresaId, ids };
  }

  /** Última posición de hoy de cada persona, consultada a Ucheck por tandas. */
  private async ultimas(personas: Identidad[], hoy: string) {
    const porPersona = new Map<number, ReturnType<typeof aPunto>>();
    // Desde la medianoche UTC del día: lo de la noche anterior se filtra abajo.
    const desde = fechaCampo(hoy).toISOString();
    for (let i = 0; i < personas.length; i += PERSONAS_POR_CONSULTA) {
      const tanda = personas.slice(i, i + PERSONAS_POR_CONSULTA);
      const { ubicaciones } = await this.ucheck.pedir<{
        ubicaciones: (PuntoUcheck & {
          ucheckUsuarioId: number;
          correo: string;
        })[];
      }>('/comercia-integracion/ubicaciones/ultimas', {
        query: {
          desde,
          ids:
            tanda
              .flatMap((p) =>
                p.identidadUcheck ? [p.identidadUcheck.ucheckUsuarioId] : [],
              )
              .join(',') || undefined,
          correos:
            tanda
              .flatMap((p) => (p.identidadUcheck ? [] : [p.correo]))
              .join(',') || undefined,
        },
      });
      for (const p of tanda) {
        const u = ubicaciones.find((x) =>
          p.identidadUcheck
            ? x.ucheckUsuarioId === p.identidadUcheck.ucheckUsuarioId
            : x.correo === p.correo.toLowerCase(),
        );
        if (u && diaDe(new Date(u.capturadaEn)) === hoy)
          porPersona.set(p.id, aPunto(u));
      }
    }
    return porPersona;
  }

  async enVivo(
    usuarioId: number,
    q: ConsultaUbicacionesDto,
  ): Promise<EquipoEnVivo> {
    const { empresaId, ids } = await this.alcance(usuarioId, q.empresaId);
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no disponible');
    const personas = await this.prisma.usuario.findMany({
      where: {
        empresaId,
        isActive: true,
        esSuperadmin: false,
        rol: { equipoCampoId: { not: null } },
        ...(ids ? { id: { in: ids } } : {}),
      },
      select: {
        ...IDENTIDAD_SELECT,
        nombre: true,
        apellido: true,
        rol: { select: { descripcion: true } },
      },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }, { id: 'asc' }],
      take: LIMITE_PERSONAS_EN_VIVO + 1,
    });
    if (personas.length > LIMITE_PERSONAS_EN_VIVO)
      throw new PayloadTooLargeException(
        'El equipo supera el máximo de personas que se pueden mostrar',
      );
    const ahora = new Date();
    const hoy = diaDe(ahora);
    const posiciones = await this.ultimas(personas, hoy);
    return {
      empresa,
      fecha: hoy,
      actualizadaEn: ahora,
      intervaloSegundos: INTERVALO_PING_SEGUNDOS,
      personas: personas.map((p) => ({
        id: p.id,
        nombre: `${p.nombre} ${p.apellido}`.trim(),
        rol: p.rol?.descripcion ?? null,
        ultima: posiciones.get(p.id) ?? null,
      })),
    };
  }

  async recorrido(
    usuarioId: number,
    personaId: number,
    q: ConsultaRecorridoDto,
  ) {
    const { empresaId, ids } = await this.alcance(usuarioId, q.empresaId);
    // Mismo mensaje fuera del alcance o inexistente: no revela quién existe.
    const sinAcceso = new NotFoundException('Persona no disponible');
    if (ids && !ids.includes(personaId)) throw sinAcceso;
    const persona = await this.prisma.usuario.findFirst({
      where: { id: personaId, empresaId, esSuperadmin: false },
      select: { ...IDENTIDAD_SELECT, nombre: true, apellido: true },
    });
    if (!persona) throw sinAcceso;
    const dia = q.fecha ?? diaDe(new Date());
    const fecha = fechaCampo(dia);
    // Ventana amplia en UTC; se queda lo que cae en el día de campo pedido.
    const [{ puntos }, visitas] = await Promise.all([
      this.ucheck.pedir<{ puntos: PuntoUcheck[] }>(
        '/comercia-integracion/ubicaciones/recorrido',
        {
          query: {
            correo: persona.correo,
            ucheckUsuarioId: persona.identidadUcheck
              ? String(persona.identidadUcheck.ucheckUsuarioId)
              : undefined,
            desde: new Date(fecha.getTime() - DIA_MS / 2).toISOString(),
            hasta: new Date(fecha.getTime() + DIA_MS * 1.5).toISOString(),
          },
        },
      ),
      this.prisma.visitaCampo.findMany({
        where: { empresaId, usuarioId: persona.id, fecha },
        select: {
          id: true,
          entrada: true,
          salida: true,
          entradaLat: true,
          entradaLng: true,
          local: { select: LOCAL_OCRD_SELECT },
        },
        orderBy: { entrada: 'asc' },
        take: 200,
      }),
    ]);
    const locales = visitas.map((v) => {
      const local = aLocalCampo(v.local);
      return {
        id: v.id,
        local: { id: local.id, nombre: local.nombre },
        latitud: local.latitud ?? v.entradaLat,
        longitud: local.longitud ?? v.entradaLng,
        entrada: v.entrada,
        salida: v.salida,
      };
    });
    return {
      persona: {
        id: persona.id,
        nombre: `${persona.nombre} ${persona.apellido}`.trim(),
      },
      fecha: dia,
      visitas: locales,
      ...calcularRecorrido(
        puntos.map(aPunto).filter((p) => diaDe(p.capturadaEn) === dia),
        locales,
      ),
    };
  }
}
