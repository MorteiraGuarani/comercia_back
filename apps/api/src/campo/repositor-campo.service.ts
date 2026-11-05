import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampoAccesoService } from './campo-acceso.service';
import { fechaCampo, relojCampo } from './utils/calendario';
import { VISITA_CAMPO_SELECT } from './utils/selectores';
import { conEstadoVisita } from './utils/estado-jornada';
import { conLocalCampo } from './utils/local-ocrd';
import { DestinatarioTareaCampo } from '../../generated/prisma/client';
import {
  exigirEquipoCampo,
  EQUIPO_CAMPO_SELECT,
  EQUIPO_TITULAR_SELECT,
  ROL_OPERATIVO,
} from './utils/equipo-campo';
import { obtenerItinerarioHeredado } from './utils/autorizacion';
import type {
  EntradaRepositorCampoDto,
  MarcaRepositorCampoDto,
  MarcaSinConexionCampoDto,
  UbicacionNavegadorDto,
} from './dto/campo.dto';
import type { MarcacionRepositorUcheck } from './interfaces/marcacion-repositor.interface';
import type { EquipoCampoDto } from '../roles/interfaces/equipo-campo.interface';
import { UcheckSincronizacionService } from '../ucheck/ucheck-sincronizacion.service';
import { UcheckClienteService } from '../ucheck/ucheck-cliente.service';
import {
  PAGINA_TAMANO_MAXIMO,
  PaginacionDto,
  rangoPaginacion,
  respuestaPaginada,
} from '../common/utils/paginacion';
import type { EntradaCampoDto, MarcaCampoDto } from './dto/campo.dto';

type UbicacionMarca = {
  latitud: number;
  longitud: number;
  precisionMetros: number;
  capturadaEn: string;
};

const ubicacionDe = (dto: UbicacionNavegadorDto): UbicacionMarca => ({
  latitud: dto.latitud,
  longitud: dto.longitud,
  precisionMetros: dto.precisionMetros,
  capturadaEn: new Date(dto.capturadaEn).toISOString(),
});

@Injectable()
export class RepositorCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
    private readonly config: ConfigService,
    private readonly sincronizacion: UcheckSincronizacionService,
    private readonly ucheck: UcheckClienteService,
  ) {}

  async esRepositor(usuarioId: number) {
    const usuario = await this.acceso.ejecutar(usuarioId);
    // Un jefe sin equipo marca como los demás líderes: vía Ucheck.
    return usuario.equipoCampo?.tipo === 'REPOSITOR';
  }

  async estadoTelefono(usuarioId: number) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Estado no disponible');
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        correo: true,
        permitirVinculoAutomatico: true,
        identidadUcheck: { select: { ucheckUsuarioId: true } },
      },
    });
    if (!usuario) throw new NotFoundException('Cuenta no disponible');
    if (!usuario.permitirVinculoAutomatico && !usuario.identidadUcheck)
      return {
        estado: 'NO_HABILITADO',
        mensaje:
          'Un administrador debe volver a vincular esta cuenta con Ucheck',
      };
    const base = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      return {
        estado: 'SIN_CONEXION',
        mensaje: 'Ucheck no está configurado para consultar el teléfono',
      };
    try {
      const query = new URLSearchParams(
        usuario.identidadUcheck
          ? { ucheckUsuarioId: String(usuario.identidadUcheck.ucheckUsuarioId) }
          : { correo: usuario.correo },
      );
      const r = await fetch(
        `${base.replace(/\/$/, '')}/comercia-repositor/estado?${query}`,
        {
          headers: { Authorization: `Bearer ${secreto}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.status === 404)
        return {
          estado: 'NO_HABILITADO',
          mensaje:
            'La cuenta aún no está vinculada a un repositor activo en Ucheck',
        };
      if (!r.ok) throw new Error('Consulta rechazada');
      const data = (await r.json()) as {
        habilitado?: boolean;
        seguimientoActivo?: boolean;
        ubicacionReciente?: boolean;
        capturadaEn?: string | null;
        precisionMetros?: number | null;
      };
      if (!data.habilitado)
        return {
          estado: 'NO_HABILITADO',
          mensaje:
            'El programa Repositor no está habilitado para esta cuenta en Ucheck',
        };
      if (data.ubicacionReciente)
        return {
          estado: 'LISTO',
          mensaje: 'Ubicación reciente recibida de Ucheck',
          capturadaEn: data.capturadaEn ?? null,
          precisionMetros: data.precisionMetros ?? null,
        };
      return {
        estado: data.seguimientoActivo
          ? 'DESACTUALIZADO'
          : 'SEGUIMIENTO_DETENIDO',
        mensaje: data.seguimientoActivo
          ? 'Abrí Ucheck y tocá Actualizar ubicación'
          : 'Iniciá el seguimiento laboral en Ucheck para marcar en Comercia',
        capturadaEn: data.capturadaEn ?? null,
      };
    } catch {
      return {
        estado: 'SIN_CONEXION',
        mensaje:
          'No se pudo consultar Ucheck. No se confirmó el estado del teléfono',
      };
    }
  }

  // La marcación se guarda en Ucheck (fuente) y la copia local llega por GET.
  private async enviar(datos: {
    usuarioId: number;
    asignacionId: number;
    horarioId?: number | null;
    fecha: string;
    tipo: 'ENTRADA' | 'SALIDA';
    nota?: string;
    /** Ubicación del navegador. Sin ella, Ucheck espera la de su app. */
    ubicacion?: UbicacionMarca;
    /** Hora real de una marca que la web guardó sin conexión. */
    registradaEn?: string;
  }): Promise<MarcacionRepositorUcheck> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: datos.usuarioId },
      select: {
        correo: true,
        identidadUcheck: { select: { ucheckUsuarioId: true } },
        permitirVinculoAutomatico: true,
        isActive: true,
        rol: {
          select: {
            descripcion: true,
            equipoCampo: { select: EQUIPO_CAMPO_SELECT },
          },
        },
      },
    });
    // Un jefe sin equipo marca solo en lo heredado; Ucheck lo valida con su agenda.
    if (!usuario?.isActive || usuario.rol?.equipoCampo?.activo === false)
      throw new ForbiddenException('Marcación no disponible');
    if (!usuario.permitirVinculoAutomatico && !usuario.identidadUcheck)
      throw new ForbiddenException(
        'Un administrador debe volver a vincular esta cuenta con Ucheck',
      );
    const base = this.config.get<string>('integrations.ucheckApiUrl');
    const secreto = this.config.get<string>('integrations.ucheckSecret');
    if (!base || !secreto)
      throw new ServiceUnavailableException({
        message: 'Ucheck no está configurado para registrar marcaciones',
        codigo: 'UCHECK_SIN_CONEXION',
      });
    let respuesta: Response;
    try {
      respuesta = await fetch(
        `${base.replace(/\/$/, '')}/comercia-integracion/marcar`,
        {
          method: 'POST',
          // Sin ubicación, Ucheck espera hasta 20 s la lectura del teléfono.
          signal: AbortSignal.timeout(datos.ubicacion ? 15_000 : 35_000),
          headers: {
            Authorization: `Bearer ${secreto}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: usuario.correo,
            ucheckUsuarioId: usuario.identidadUcheck?.ucheckUsuarioId,
            asignacionId: datos.asignacionId,
            horarioId: datos.horarioId ?? undefined,
            fecha: datos.fecha,
            tipo: datos.tipo,
            ubicacion: datos.ubicacion,
            registradaEn: datos.registradaEn,
          }),
        },
      );
    } catch {
      // UCHECK_SIN_CONEXION: la web guarda la marca en el navegador.
      throw new ServiceUnavailableException({
        message:
          'No se pudo conectar con Ucheck para confirmar la operación. Consultá la visita y reintentá; los reintentos no duplican la marcación',
        codigo: 'UCHECK_SIN_CONEXION',
      });
    }
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        message?: string | string[];
        codigo?: string;
      } | null;
      const mensaje = Array.isArray(cuerpo?.message)
        ? cuerpo.message.join('. ')
        : cuerpo?.message;
      if (respuesta.status >= 400 && respuesta.status < 500)
        throw new BadRequestException({
          message:
            typeof mensaje === 'string'
              ? mensaje
              : 'Ucheck rechazó la marcación',
          // TELEFONO_SIN_UBICACION: la web reintenta con el GPS del navegador.
          codigo: cuerpo?.codigo,
        });
      // Reintentar no duplica: Ucheck identifica cada marca por su operación.
      throw new ServiceUnavailableException({
        message:
          'Ucheck no pudo confirmar el resultado de la operación. Revisá la visita antes de reintentar',
        codigo: 'UCHECK_SIN_CONEXION',
      });
    }
    const cuerpo = (await respuesta.json()) as MarcacionRepositorUcheck;
    if (
      !Number.isSafeInteger(cuerpo.ucheckJornadaId) ||
      cuerpo.ucheckJornadaId < 1 ||
      cuerpo.tipo !== datos.tipo ||
      (cuerpo.estado !== undefined &&
        !['PENDIENTE', 'CONFIRMADA'].includes(cuerpo.estado)) ||
      (cuerpo.estado === 'PENDIENTE' && !cuerpo.operacionId)
    )
      throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
    // Trae ya la copia de Ucheck para responder con la visita; si falla, la
    // marcación queda guardada en Ucheck y llega en la próxima sincronización.
    await this.sincronizacion.ahora().catch(() => undefined);
    if (cuerpo.operacionId) {
      if (!/^rep-[a-f0-9]{48}$/.test(cuerpo.operacionId))
        throw new ServiceUnavailableException('Respuesta de Ucheck inválida');
      const operacionId = cuerpo.operacionId;
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${cuerpo.ucheckJornadaId})`;
        const anterior = await tx.operacionCampo.findUnique({
          where: { id: operacionId },
          select: { usuarioId: true },
        });
        if (anterior && anterior.usuarioId !== datos.usuarioId)
          throw new ServiceUnavailableException(
            'Operación de Ucheck no disponible',
          );
        const visita = await tx.visitaCampo.findFirst({
          where: {
            usuarioId: datos.usuarioId,
            ucheckJornadaId: cuerpo.ucheckJornadaId,
          },
          select: { id: true, salida: true },
        });
        const estado =
          visita && (datos.tipo === 'ENTRADA' || visita.salida)
            ? 'CONFIRMADA'
            : 'PENDIENTE';
        await tx.operacionCampo.upsert({
          where: { id: operacionId },
          create: {
            id: operacionId,
            usuarioId: datos.usuarioId,
            ucheckJornadaId: cuerpo.ucheckJornadaId,
            tipo: datos.tipo,
            estado,
            nota: datos.nota ?? '',
          },
          update: { estado, nota: datos.nota },
          select: { id: true },
        });
        if (estado === 'CONFIRMADA' && visita && datos.nota)
          await tx.visitaCampo.update({
            where: { id: visita.id },
            data:
              datos.tipo === 'ENTRADA'
                ? { notaEntrada: datos.nota }
                : { notaSalida: datos.nota },
            select: { id: true },
          });
        cuerpo.estado = estado;
      });
    }
    return cuerpo;
  }

  async estadoOperacion(usuarioId: number, id: string) {
    if (!/^rep-[a-f0-9]{48}$/.test(id))
      throw new BadRequestException('Identificador de operación inválido');
    await this.acceso.ejecutar(usuarioId);
    // Si todavía está pendiente, vuelve a traer de Ucheck antes de responder.
    await this.sincronizacion.ahora().catch(() => undefined);
    const op = await this.prisma.operacionCampo.findFirst({
      where: { id, usuarioId },
      select: { ucheckJornadaId: true, tipo: true, nota: true },
    });
    if (!op) throw new NotFoundException('Operación no disponible');
    const visita = await this.prisma.visitaCampo.findFirst({
      where: { usuarioId, ucheckJornadaId: op.ucheckJornadaId },
      select: { id: true, salida: true },
    });
    if (visita && (op.tipo === 'ENTRADA' || visita.salida)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.operacionCampo.update({
          where: { id },
          data: { estado: 'CONFIRMADA' },
          select: { id: true },
        });
        if (op.nota)
          await tx.visitaCampo.update({
            where: { id: visita.id },
            data:
              op.tipo === 'ENTRADA'
                ? { notaEntrada: op.nota }
                : { notaSalida: op.nota },
            select: { id: true },
          });
      });
      return { estado: 'CONFIRMADA', mensaje: 'Marcación confirmada' };
    }
    return {
      estado: 'PENDIENTE',
      mensaje:
        'Marcación guardada en Ucheck, pendiente de sincronización. La confirmación se consulta sin crear otra marcación.',
    };
  }

  /** Marcas que Ucheck ya guardó y cuya copia todavía no llegó a Comercia. */
  async operacionesPendientes(usuarioId: number, query: PaginacionDto) {
    await this.acceso.ejecutar(usuarioId);
    const where = { usuarioId, estado: 'PENDIENTE' };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.operacionCampo.count({ where }),
      this.prisma.operacionCampo.findMany({
        where,
        select: { id: true, tipo: true, creadaEn: true },
        orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }

  /**
   * Botón «Reintentar»: Ucheck vuelve a poner en cola, sin espera, las marcas
   * pendientes de la persona (también las que agotaron sus 10 intentos) y
   * Comercia las trae en ese momento. Devuelve cuántas siguen sin llegar.
   */
  async reintentarPendientes(usuarioId: number) {
    await this.acceso.ejecutar(usuarioId);
    const where = { usuarioId, estado: 'PENDIENTE' };
    const ops = await this.prisma.operacionCampo.findMany({
      where,
      select: { id: true },
      orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
      take: PAGINA_TAMANO_MAXIMO,
    });
    if (ops.length) {
      await this.ucheck.pedir('/comercia-integracion/marcaciones/reintentar', {
        method: 'POST',
        body: { ids: ops.map((o) => o.id) },
      });
      // Trae de Ucheck y confirma cada una, como la consulta de una operación.
      for (const op of ops) await this.estadoOperacion(usuarioId, op.id);
    }
    return { pendientes: await this.prisma.operacionCampo.count({ where }) };
  }

  async entrada(usuarioId: number, dto: EntradaRepositorCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const hoy = relojCampo().fecha;
    const fecha = fechaCampo(hoy);
    // El supervisor marca también en los locales de su cadena, como en su
    // Itinerario y en la integración con Ucheck.
    const heredados = await obtenerItinerarioHeredado(this.prisma, u);
    const backupHoy = {
      activo: true,
      fechaDesde: { lte: fecha },
      fechaHasta: { gte: fecha },
    };
    const asignacion = await this.prisma.asignacionCampo.findFirst({
      where: {
        id: dto.asignacionId,
        usuario: { rol: ROL_OPERATIVO },
        activo: true,
        fechaDesde: { lte: fecha },
        AND: [
          { OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }] },
          {
            OR: [
              { usuarioId, backups: { none: backupHoy } },
              { backups: { some: { usuarioId, ...backupHoy } } },
              ...(heredados.length
                ? [
                    {
                      usuarioId: { in: heredados },
                      backups: { none: backupHoy },
                    },
                    {
                      backups: {
                        some: { usuarioId: { in: heredados }, ...backupHoy },
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
        empresaId: u.empresaId,
      },
      select: { id: true },
    });
    if (!asignacion) throw new NotFoundException('Asignación no disponible');
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: dto.asignacionId,
      horarioId: dto.horarioId,
      fecha: hoy,
      tipo: 'ENTRADA',
      nota: dto.nota,
      ubicacion: dto.ubicacion && ubicacionDe(dto.ubicacion),
    });
    return this.trasEntrada(usuarioId, resultado, dto.nota);
  }

  private async trasEntrada(
    usuarioId: number,
    resultado: MarcacionRepositorUcheck,
    nota?: string,
  ) {
    const visita = await this.prisma.visitaCampo.findFirst({
      where: { ucheckJornadaId: resultado.ucheckJornadaId, usuarioId },
      select: VISITA_CAMPO_SELECT,
    });
    if (!visita && resultado.estado === 'PENDIENTE') return resultado;
    if (!visita)
      throw new ServiceUnavailableException(
        'La entrada está sincronizándose; actualizá la ruta',
      );
    if (nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaEntrada: nota },
        select: { id: true },
      });
    return conLocalCampo(conEstadoVisita(visita));
  }

  /**
   * Roles que no son repositores (impulsadores, TeamLeaders, supervisores): la
   * marca se guarda en Ucheck con la ubicación del navegador o, sin ella, con
   * la del teléfono en Ucheck. Ucheck valida asignación, franja, GPS y
   * tolerancias con la agenda de Comercia.
   */
  async entradaWeb(
    usuarioId: number,
    dto: EntradaCampoDto | EntradaRepositorCampoDto,
  ) {
    await this.acceso.ejecutar(usuarioId);
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: dto.asignacionId,
      horarioId: dto.horarioId,
      fecha: relojCampo().fecha,
      tipo: 'ENTRADA',
      nota: dto.nota,
      ubicacion:
        'latitud' in dto
          ? ubicacionDe(dto)
          : dto.ubicacion && ubicacionDe(dto.ubicacion),
    });
    return this.trasEntrada(usuarioId, resultado, dto.nota);
  }

  /**
   * Salida desde la web. Devuelve null si la visita se abrió antes de pasar
   * por Ucheck: esa se cierra como antes, en Comercia.
   */
  async salidaWeb(
    usuarioId: number,
    visitaId: number,
    dto: MarcaCampoDto | MarcaRepositorCampoDto,
  ) {
    const u = await this.acceso.ejecutar(usuarioId);
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        id: visitaId,
        usuarioId,
        fecha: fechaCampo(relojCampo().fecha),
        salida: null,
        empresaId: u.empresaId,
      },
      select: {
        id: true,
        asignacionId: true,
        horarioId: true,
        fecha: true,
        origen: true,
      },
    });
    if (!visita) throw new NotFoundException('Visita abierta no disponible');
    if (visita.origen !== 'UCHECK') return null;
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: visita.asignacionId,
      horarioId: visita.horarioId,
      fecha: visita.fecha.toISOString().slice(0, 10),
      tipo: 'SALIDA',
      nota: dto.nota,
      ubicacion:
        'latitud' in dto
          ? ubicacionDe(dto)
          : dto.ubicacion && ubicacionDe(dto.ubicacion),
    });
    if (resultado.estado === 'PENDIENTE') return resultado;
    if (dto.nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaSalida: dto.nota },
        select: { id: true },
      });
    return { ok: true };
  }

  async salida(
    usuarioId: number,
    visitaId: number,
    dto: MarcaRepositorCampoDto,
  ) {
    const u = await this.acceso.ejecutar(usuarioId);
    if (exigirEquipoCampo(u.equipoCampo).tipo !== 'REPOSITOR')
      throw new ForbiddenException('Marcación no disponible');
    const visita = await this.prisma.visitaCampo.findFirst({
      where: {
        id: visitaId,
        usuarioId,
        fecha: fechaCampo(relojCampo().fecha),
        salida: null,
        origen: 'UCHECK',
        empresaId: u.empresaId,
      },
      select: {
        id: true,
        localId: true,
        asignacionId: true,
        horarioId: true,
        fecha: true,
        ucheckJornadaId: true,
        asignacion: { select: EQUIPO_TITULAR_SELECT },
      },
    });
    if (!visita?.ucheckJornadaId)
      throw new NotFoundException('Visita abierta no disponible');
    await this.exigirTareasCompletas(u, visita);
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: visita.asignacionId,
      horarioId: visita.horarioId,
      fecha: visita.fecha.toISOString().slice(0, 10),
      tipo: 'SALIDA',
      nota: dto.nota,
      ubicacion: dto.ubicacion && ubicacionDe(dto.ubicacion),
    });
    if (resultado.estado === 'PENDIENTE') return resultado;
    if (dto.nota)
      await this.prisma.visitaCampo.update({
        where: { id: visita.id },
        data: { notaSalida: dto.nota },
        select: { id: true },
      });
    return { ok: true };
  }

  /**
   * En un local de repositores se terminan las tareas aplicables antes de
   * cerrar la visita. Son las del equipo del titular del local, aunque marque
   * un líder que lo hereda.
   */
  private async exigirTareasCompletas(
    u: Awaited<ReturnType<CampoAccesoService['ejecutar']>>,
    visita: {
      id: number;
      localId: string;
      fecha: Date;
      asignacion: {
        usuario: { rol: { equipoCampo: EquipoCampoDto | null } | null };
      };
    },
  ) {
    const equipo = visita.asignacion.usuario.rol?.equipoCampo;
    if (equipo?.tipo !== DestinatarioTareaCampo.REPOSITOR) return;
    const pendientes = await this.prisma.tareaCampo.count({
      where: {
        empresaId: u.empresaId,
        destinatario: DestinatarioTareaCampo.REPOSITOR,
        equipoCampoId: equipo.id,
        OR: [
          {
            activo: true,
            fechaDesde: { lte: visita.fecha },
            AND: [
              {
                OR: [
                  { fechaHasta: null },
                  { fechaHasta: { gte: visita.fecha } },
                ],
              },
              {
                OR: [
                  { todosLocales: true },
                  { locales: { some: { localId: visita.localId } } },
                ],
              },
            ],
          },
          {
            cumplimientos: {
              some: { visitaId: visita.id, completadaAt: null },
            },
          },
        ],
        cumplimientos: {
          none: { visitaId: visita.id, NOT: { completadaAt: null } },
        },
      },
    });
    if (pendientes)
      throw new BadRequestException(
        pendientes === 1
          ? 'Completá la tarea pendiente antes de finalizar la visita'
          : `Completá las ${pendientes} tareas pendientes antes de finalizar la visita`,
      );
  }

  /**
   * Marca que la web guardó en el navegador porque no había conexión con
   * Ucheck: va con su hora y su GPS reales, y Ucheck la valida con esa hora.
   * Reenviarla no la duplica (Ucheck identifica cada marca por su operación).
   */
  async marcaSinConexion(usuarioId: number, dto: MarcaSinConexionCampoDto) {
    const u = await this.acceso.ejecutar(usuarioId);
    const edad = Date.now() - new Date(dto.tomadaEn).getTime();
    if (!(edad > -120_000 && edad < 7 * 86_400_000))
      throw new BadRequestException(
        'La hora de la marca guardada sin conexión no es válida',
      );
    // Las tareas del repositor no se saltean marcando sin conexión.
    if (dto.tipo === 'SALIDA' && u.equipoCampo?.tipo === 'REPOSITOR') {
      const visita = await this.prisma.visitaCampo.findFirst({
        where: {
          usuarioId,
          asignacionId: dto.asignacionId,
          horarioId: dto.horarioId ?? null,
          fecha: fechaCampo(dto.fecha),
          empresaId: u.empresaId,
        },
        select: {
          id: true,
          localId: true,
          fecha: true,
          asignacion: { select: EQUIPO_TITULAR_SELECT },
        },
      });
      if (visita) await this.exigirTareasCompletas(u, visita);
    }
    const resultado = await this.enviar({
      usuarioId,
      asignacionId: dto.asignacionId,
      horarioId: dto.horarioId,
      fecha: dto.fecha,
      tipo: dto.tipo,
      nota: dto.nota,
      ubicacion: ubicacionDe(dto.ubicacion),
      registradaEn: new Date(dto.tomadaEn).toISOString(),
    });
    return { estado: resultado.estado ?? 'CONFIRMADA' };
  }
}
