import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampoAccesoService } from '../campo/campo-acceso.service';
import { obtenerEquipoCompleto } from '../campo/utils/autorizacion';
import { fechaCampo, relojCampo } from '../campo/utils/calendario';
import { aLocalCampo, LOCAL_OCRD_SELECT } from '../campo/utils/local-ocrd';
import type {
  ConsultaRecorridoDto,
  ConsultaUbicacionesDto,
  LotePingsDto,
} from './dto/ubicacion.dto';
import type { EquipoEnVivo } from './interfaces/equipo-en-vivo.interface';
import {
  ADELANTO_MAXIMO_PING_MS,
  ANTIGUEDAD_MAXIMA_PING_MS,
  INTERVALO_PING_SEGUNDOS,
  LIMITE_PERSONAS_EN_VIVO,
  LIMITE_PUNTOS_RECORRIDO,
  PAGINA_UBICACIONES,
  RETENCION_UBICACIONES_DIAS,
} from './ubicaciones.constants';
import { enJornada } from './utils/jornada';
import { calcularRecorrido } from './utils/recorrido';

const DIA_MS = 24 * 60 * 60_000;
const PRIMERA_LIMPIEZA_MS = 10 * 60_000;

const POSICION_SELECT = {
  usuarioId: true,
  latitud: true,
  longitud: true,
  precisionMetros: true,
  velocidadMps: true,
  rumboGrados: true,
  capturadaEn: true,
} as const;

/**
 * Posición del equipo de campo durante la jornada: la manda el navegador de
 * cada persona y la ven el superadmin (toda la empresa) y cada líder (su
 * cadena, igual que Presentismo).
 */
@Injectable()
export class UbicacionesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UbicacionesService.name);
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}

  onModuleInit() {
    // La primera pasada no espera un día: la API se reinicia en cada despliegue.
    this.temporizadores = [
      setTimeout(() => void this.limpiar(), PRIMERA_LIMPIEZA_MS),
      setInterval(() => void this.limpiar(), DIA_MS),
    ];
  }

  onModuleDestroy() {
    this.temporizadores.forEach(clearTimeout);
  }

  async limpiar(ahora = new Date()): Promise<number> {
    const limite = new Date(
      fechaCampo(relojCampo(ahora).fecha).getTime() -
        RETENCION_UBICACIONES_DIAS * DIA_MS,
    );
    try {
      const { count } = await this.prisma.ubicacionCampo.deleteMany({
        where: { fecha: { lt: limite } },
      });
      if (count)
        this.logger.log(`Ubicaciones borradas por retención: ${count}`);
      return count;
    } catch (error) {
      this.logger.error('No se pudieron borrar ubicaciones viejas', error);
      return 0;
    }
  }

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
    const visitas = await this.visitasDe(u, [relojCampo(ahora).fecha]);
    return {
      activa: enJornada(ahora, visitas),
      intervaloSegundos: INTERVALO_PING_SEGUNDOS,
    };
  }

  /** Guarda lo tomado durante la jornada; el reenvío del mismo punto no duplica. */
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
    const fechas = new Set([
      relojCampo(ahora).fecha,
      ...pings.map(({ t }) => relojCampo(t).fecha),
    ]);
    const visitas = await this.visitasDe(u, [...fechas]);
    const filas = pings
      .filter(({ t }) => enJornada(t, visitas))
      .map((p) => ({
        empresaId: u.empresaId,
        usuarioId: u.id,
        fecha: fechaCampo(relojCampo(p.t).fecha),
        capturadaEn: p.t,
        latitud: p.latitud,
        longitud: p.longitud,
        precisionMetros: p.precisionMetros,
        velocidadMps: p.velocidadMps ?? null,
        rumboGrados: p.rumboGrados ?? null,
      }));
    const { count } = filas.length
      ? await this.prisma.ubicacionCampo.createMany({
          data: filas,
          skipDuplicates: true,
        })
      : { count: 0 };
    return {
      guardados: count,
      descartados: dto.pings.length - filas.length,
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
        id: true,
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
    const hoy = relojCampo(ahora).fecha;
    const fecha = fechaCampo(hoy);
    const ultimas = personas.length
      ? await this.prisma.ubicacionCampo.groupBy({
          by: ['usuarioId'],
          where: {
            empresaId,
            fecha,
            usuarioId: { in: personas.map((p) => p.id) },
          },
          _max: { capturadaEn: true },
        })
      : [];
    const posiciones = ultimas.length
      ? await this.prisma.ubicacionCampo.findMany({
          where: {
            empresaId,
            fecha,
            OR: ultimas.map((u) => ({
              usuarioId: u.usuarioId,
              capturadaEn: u._max.capturadaEn!,
            })),
          },
          select: POSICION_SELECT,
          take: ultimas.length,
        })
      : [];
    const porUsuario = new Map(posiciones.map((p) => [p.usuarioId, p]));
    return {
      empresa,
      fecha: hoy,
      actualizadaEn: ahora,
      intervaloSegundos: INTERVALO_PING_SEGUNDOS,
      personas: personas.map((p) => {
        const pos = porUsuario.get(p.id);
        return {
          id: p.id,
          nombre: `${p.nombre} ${p.apellido}`.trim(),
          rol: p.rol?.descripcion ?? null,
          ultima: pos
            ? {
                latitud: pos.latitud,
                longitud: pos.longitud,
                precisionMetros: pos.precisionMetros,
                velocidadMps: pos.velocidadMps,
                rumboGrados: pos.rumboGrados,
                capturadaEn: pos.capturadaEn,
              }
            : null,
        };
      }),
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
      select: { id: true, nombre: true, apellido: true },
    });
    if (!persona) throw sinAcceso;
    const dia = q.fecha ?? relojCampo().fecha;
    const fecha = fechaCampo(dia);
    const [puntos, visitas] = await Promise.all([
      this.prisma.ubicacionCampo.findMany({
        where: { empresaId, usuarioId: persona.id, fecha },
        select: {
          latitud: true,
          longitud: true,
          precisionMetros: true,
          velocidadMps: true,
          capturadaEn: true,
        },
        orderBy: { capturadaEn: 'asc' },
        take: LIMITE_PUNTOS_RECORRIDO + 1,
      }),
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
    if (puntos.length > LIMITE_PUNTOS_RECORRIDO)
      throw new PayloadTooLargeException(
        'El recorrido supera el máximo de puntos que se pueden mostrar',
      );
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
      ...calcularRecorrido(puntos, locales),
    };
  }
}
