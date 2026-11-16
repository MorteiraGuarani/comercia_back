import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoPaginacion, respuestaPaginada } from '../common/utils/paginacion';
import { CampoAccesoService } from './campo-acceso.service';
import {
  AsignacionCampoDto,
  BackupCampoDto,
  ConsultaCampoDto,
  HorarioCampoDto,
} from './dto/campo.dto';
import {
  ASIGNACION_CAMPO_SELECT,
  BACKUP_CAMPO_SELECT,
  HORARIO_CAMPO_SELECT,
} from './utils/selectores';
import {
  fechaCampo,
  relojCampo,
  validarHorario,
  vigenciaCampo,
} from './utils/calendario';
import {
  SeleccionLocalesDto,
  TraspasoAsignacionesDto,
} from './dto/traspaso.dto';
import { Prisma } from '../../generated/prisma/client';
import { destinatarioCampo, exigirEquipoCampo } from './utils/equipo-campo';
import { filtroPersonalEquipoOperativo } from './utils/personal-equipo';
import { AuditoriaService } from '../common/auditoria/auditoria.service';
import { nombrePersona } from '../common/utils/auditoria';

// Un traspaso corre en una sola transacción: tope para que no la alargue de más.
const LIMITE_TRASPASO = 500;

@Injectable()
export class PlanificacionCampoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  async equipo(usuarioId: number, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const buscar = query.buscar?.trim();
    const where: Prisma.UsuarioWhereInput = {
      ...filtroPersonalEquipoOperativo(u),
      ...(buscar
        ? {
            OR: [
              { nombre: { contains: buscar, mode: 'insensitive' } },
              { apellido: { contains: buscar, mode: 'insensitive' } },
              { nombreLogin: { contains: buscar, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, usuarios] = await Promise.all([
      this.prisma.usuario.count({ where }),
      this.prisma.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          rol: { select: { descripcion: true } },
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(
      usuarios.map((x) => ({
        id: x.id,
        nombre: `${x.nombre} ${x.apellido} · ${x.rol?.descripcion ?? 'Sin rol'}`,
      })),
      total,
      page,
      limit,
    );
  }
  async horarios(usuarioId: number, localId: string, query: ConsultaCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const where = {
      empresaId: u.empresaId,
      localId,
      asignacionId: null,
      equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
      destinatario: destinatarioCampo(u.equipoCampo),
      activo: true,
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.horarioCampo.count({ where }),
      this.prisma.horarioCampo.findMany({
        where,
        select: HORARIO_CAMPO_SELECT,
        orderBy: [{ entrada: 'asc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarHorario(
    usuarioId: number,
    localId: string,
    dto: HorarioCampoDto,
    id?: number,
    asignacionId?: number,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const destinatario = destinatarioCampo(u.equipoCampo);
    const equipoCampoId = exigirEquipoCampo(u.equipoCampo).id;
    const a = asignacionId
      ? (await this.asignacionDelEquipo(usuarioId, asignacionId)).a
      : null;
    if (a && a.localId !== localId)
      throw new NotFoundException('Asignación no disponible');
    const data = { ...dto, ...vigenciaCampo(dto.fechaDesde, dto.fechaHasta) };
    validarHorario(data);
    const { horario, anterior } = await this.prisma.$transaction(async (tx) => {
      // Serializa cambios por local y limita el tamaño de los horarios de agenda.
      await tx.$queryRaw`SELECT id FROM tbl_ocrd WHERE empresa_id = ${u.empresaId} AND "CardCode" = ${localId} FOR UPDATE`;
      const anterior = id
        ? await tx.horarioCampo.findFirst({
            where: {
              id,
              empresaId: u.empresaId,
              localId,
              asignacionId: asignacionId ?? null,
              destinatario,
              equipoCampoId,
              activo: true,
            },
            select: HORARIO_CAMPO_SELECT,
          })
        : null;
      if (id) {
        if (!anterior) throw new NotFoundException('Horario no disponible');
        // Versionar conserva la referencia y el rango de las visitas históricas.
        await tx.horarioCampo.update({
          where: { id },
          data: { activo: false },
        });
      }
      if (
        (await tx.horarioCampo.count({
          where: {
            empresaId: u.empresaId,
            localId,
            asignacionId: asignacionId ?? null,
            destinatario,
            equipoCampoId,
            activo: true,
          },
        })) >= 20
      )
        throw new BadRequestException('Máximo 20 franjas activas por local');
      const horario = await tx.horarioCampo.create({
        data: {
          ...data,
          empresaId: u.empresaId,
          localId,
          asignacionId: asignacionId ?? null,
          destinatario,
          equipoCampoId,
        },
        select: HORARIO_CAMPO_SELECT,
      });
      if (id) {
        const configuracion = await tx.configuracionTolerancia.findUnique({
          where: { clave: 'horario:' + id },
          select: { valores: true },
        });
        if (configuracion)
          await tx.configuracionTolerancia.create({
            data: {
              clave: 'horario:' + horario.id,
              empresaId: u.empresaId,
              valores: configuracion.valores as Prisma.InputJsonValue,
            },
            select: { clave: true },
          });
      }
      return { horario, anterior };
    });
    // Editar versiona: el horario nuevo reemplaza al anterior (otro id).
    await this.auditoria?.registrar({
      accion: anterior ? 'MODIFICAR' : 'CREAR',
      entidad: 'Horario',
      entidadId: horario.id,
      empresaId: u.empresaId,
      etiqueta: a
        ? `${nombrePersona(a.usuario)} · local ${localId}`
        : `Local ${localId}`,
      antes: anterior,
      despues: horario,
    });
    return horario;
  }
  async eliminarHorario(usuarioId: number, localId: string, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const [horario] = await this.prisma.horarioCampo.updateManyAndReturn({
      where: {
        id,
        empresaId: u.empresaId,
        localId,
        asignacionId: null,
        equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        destinatario: destinatarioCampo(u.equipoCampo),
      },
      data: { activo: false },
      select: HORARIO_CAMPO_SELECT,
    });
    if (!horario) throw new NotFoundException('Horario no disponible');
    await this.auditoria?.registrar({
      accion: 'ELIMINAR',
      entidad: 'Horario',
      entidadId: id,
      empresaId: u.empresaId,
      etiqueta: `Local ${localId}`,
      antes: { ...horario, activo: true },
    });
    return { ok: true };
  }
  async horariosAsignacion(
    usuarioId: number,
    asignacionId: number,
    query: ConsultaCampoDto,
  ) {
    const { u } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    const where = {
      asignacionId,
      equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
      destinatario: destinatarioCampo(u.equipoCampo),
      activo: true,
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.horarioCampo.count({ where }),
      this.prisma.horarioCampo.findMany({
        where,
        select: HORARIO_CAMPO_SELECT,
        orderBy: { entrada: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async guardarHorarioAsignacion(
    usuarioId: number,
    asignacionId: number,
    dto: HorarioCampoDto,
    id?: number,
  ) {
    const { a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    return this.guardarHorario(usuarioId, a.localId, dto, id, asignacionId);
  }
  async eliminarHorarioAsignacion(
    usuarioId: number,
    asignacionId: number,
    id: number,
  ) {
    const { u, a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    const [horario] = await this.prisma.horarioCampo.updateManyAndReturn({
      where: {
        id,
        asignacionId,
        equipoCampoId: exigirEquipoCampo(u.equipoCampo).id,
        destinatario: destinatarioCampo(u.equipoCampo),
        activo: true,
      },
      data: { activo: false },
      select: HORARIO_CAMPO_SELECT,
    });
    if (!horario) throw new NotFoundException('Horario no disponible');
    await this.auditoria?.registrar({
      accion: 'ELIMINAR',
      entidad: 'Horario',
      entidadId: id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(a.usuario)} · local ${a.localId}`,
      antes: { ...horario, activo: true },
    });
    return { ok: true };
  }
  async asignaciones(
    usuarioId: number,
    localId: string,
    query: ConsultaCampoDto,
  ) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    const where = {
      empresaId: u.empresaId,
      localId,
      activo: true,
      usuario: filtroPersonalEquipoOperativo(u),
    };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.asignacionCampo.count({ where }),
      this.prisma.asignacionCampo.findMany({
        where,
        select: ASIGNACION_CAMPO_SELECT,
        orderBy: { id: 'asc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async asignar(usuarioId: number, localId: string, dto: AsignacionCampoDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    await this.acceso.local(u.empresaId, localId);
    await this.acceso.subordinado(u, dto.usuarioId);
    const fechas = vigenciaCampo(dto.fechaDesde, dto.fechaHasta);
    const asignacion = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tbl_ocrd WHERE empresa_id = ${u.empresaId} AND "CardCode" = ${localId} FOR UPDATE`;
      const solapa = await tx.asignacionCampo.count({
        where: {
          empresaId: u.empresaId,
          localId,
          usuarioId: dto.usuarioId,
          activo: true,
          fechaDesde: { lte: fechas.fechaHasta ?? new Date('9999-12-31') },
          OR: [
            { fechaHasta: null },
            { fechaHasta: { gte: fechas.fechaDesde } },
          ],
        },
      });
      if (solapa)
        throw new BadRequestException(
          'El usuario ya tiene una asignación en esas fechas',
        );
      return tx.asignacionCampo.create({
        data: {
          empresaId: u.empresaId,
          localId,
          usuarioId: dto.usuarioId,
          ...fechas,
        },
        select: ASIGNACION_CAMPO_SELECT,
      });
    });
    await this.auditoria?.registrar({
      accion: 'ASIGNAR',
      entidad: 'Asignación',
      entidadId: asignacion.id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(asignacion.usuario)} · local ${localId}`,
      despues: asignacion,
    });
    return asignacion;
  }
  private async asignacionDelEquipo(usuarioId: number, id: number) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    const personal = filtroPersonalEquipoOperativo(u);
    const a = await this.prisma.asignacionCampo.findFirst({
      where: {
        id,
        activo: true,
        empresaId: u.empresaId,
        usuario: personal,
      },
      select: {
        id: true,
        localId: true,
        usuarioId: true,
        fechaDesde: true,
        fechaHasta: true,
        usuario: { select: { nombre: true, apellido: true } },
      },
    });
    if (!a) throw new NotFoundException('Asignación no disponible');
    return { u, a, personal };
  }
  async localPrincipal(usuarioId: number, id: number, principal: boolean) {
    const { u, a, personal } = await this.asignacionDelEquipo(usuarioId, id);
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        // Validación y escritura en el mismo snapshot que la asignación.
        const actual = await tx.asignacionCampo.findFirst({
          where: {
            id,
            activo: true,
            usuarioId: a.usuarioId,
            empresaId: u.empresaId,
            localId: a.localId,
            usuario: personal,
            OR: [
              { fechaHasta: null },
              {
                fechaHasta: {
                  gte: new Date(new Date().toISOString().slice(0, 10)),
                },
              },
            ],
          },
          select: { id: true },
        });
        if (!actual) throw new NotFoundException('Asignación no disponible');
        if (principal) {
          await tx.usuario.update({
            where: { id: a.usuarioId },
            data: { localPrincipalId: a.localId },
            select: { id: true },
          });
        } else {
          await tx.usuario.updateMany({
            where: {
              id: a.usuarioId,
              empresaId: u.empresaId,
              localPrincipalId: a.localId,
            },
            data: { localPrincipalId: null },
          });
        }
        return { ok: true };
      },
      { isolationLevel: 'Serializable' },
    );
    await this.auditoria?.registrar({
      accion: 'MODIFICAR',
      entidad: 'Asignación',
      entidadId: id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(a.usuario)} · local ${a.localId}`,
      antes: { localPrincipal: !principal },
      despues: { localPrincipal: principal },
    });
    return resultado;
  }
  async quitarAsignacion(usuarioId: number, id: number) {
    const { u, a } = await this.asignacionDelEquipo(usuarioId, id);
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        await tx.asignacionCampo.update({
          where: { id },
          data: { activo: false },
        });
        const conservaLocal = await tx.asignacionCampo.count({
          where: {
            empresaId: u.empresaId,
            usuarioId: a.usuarioId,
            localId: a.localId,
            activo: true,
          },
        });
        if (!conservaLocal)
          await tx.usuario.updateMany({
            where: {
              id: a.usuarioId,
              empresaId: u.empresaId,
              localPrincipalId: a.localId,
            },
            data: { localPrincipalId: null },
          });
        return { ok: true };
      },
      { isolationLevel: 'Serializable' },
    );
    await this.auditoria?.registrar({
      accion: 'QUITAR',
      entidad: 'Asignación',
      entidadId: id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(a.usuario)} · local ${a.localId}`,
      antes: { ...a, activo: true },
      despues: { ...a, activo: false },
    });
    return resultado;
  }
  /**
   * Pasa locales de un titular a otro desde una fecha y, con intercambio, también
   * al revés, en una sola transacción. Nunca cambia el titular de una asignación
   * (las visitas y los eventos de Ucheck quedan a nombre de quien las hizo):
   * cierra la del origen el día anterior y crea una nueva para el destino.
   */
  async traspasarAsignaciones(usuarioId: number, dto: TraspasoAsignacionesDto) {
    const u = await this.acceso.gestionar(usuarioId, 'locales');
    if (dto.origenId === dto.destinoId)
      throw new BadRequestException('Elegí dos personas distintas');
    // Los dos tienen que ser del equipo operativo del gestor: eso también
    // garantiza el mismo rol (repositores con repositores, impulsadores con impulsadores).
    await this.acceso.subordinado(u, dto.origenId);
    await this.acceso.subordinado(u, dto.destinoId);
    const fecha = fechaCampo(dto.fecha);
    if (fecha < fechaCampo(relojCampo().fecha))
      throw new BadRequestException('La fecha no puede ser anterior a hoy');
    const anterior = new Date(fecha.getTime() - 86_400_000);
    const vigenteEn: Prisma.AsignacionCampoWhereInput = {
      empresaId: u.empresaId,
      activo: true,
      fechaDesde: { lte: fecha },
      OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
    };

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const elegir = async (titularId: number, sel: SeleccionLocalesDto) => {
          if (!sel.todos && !sel.locales.length)
            throw new BadRequestException('Elegí al menos un local');
          const filas = await tx.asignacionCampo.findMany({
            where: {
              ...vigenteEn,
              usuarioId: titularId,
              localId: sel.todos ? { notIn: sel.excluir } : { in: sel.locales },
            },
            select: {
              id: true,
              localId: true,
              fechaDesde: true,
              fechaHasta: true,
            },
            orderBy: { localId: 'asc' },
            take: LIMITE_TRASPASO + 1,
          });
          if (filas.length > LIMITE_TRASPASO)
            throw new PayloadTooLargeException(
              `Se pueden pasar hasta ${LIMITE_TRASPASO} locales por vez`,
            );
          const faltan = sel.todos
            ? []
            : sel.locales.filter((l) => !filas.some((f) => f.localId === l));
          if (faltan.length)
            throw new BadRequestException(
              `No atiende estos locales en esa fecha: ${faltan.join(', ')}`,
            );
          return filas;
        };
        const ida = await elegir(dto.origenId, dto.seleccion);
        const vuelta = dto.intercambio
          ? await elegir(dto.destinoId, dto.intercambio)
          : [];
        const repetidos = ida.filter((a) =>
          vuelta.some((b) => b.localId === a.localId),
        );
        if (repetidos.length)
          throw new BadRequestException(
            `Estos locales están en las dos listas: ${repetidos.map((a) => a.localId).join(', ')}`,
          );

        const omitidos: { localId: string; motivo: string }[] = [];
        const pasar = async (filas: typeof ida, deId: number, aId: number) => {
          let pasados = 0;
          for (const a of filas) {
            await tx.$queryRaw`SELECT id FROM tbl_ocrd WHERE empresa_id = ${u.empresaId} AND "CardCode" = ${a.localId} FOR UPDATE`;
            // Cierre: si empezaba ese día o después, no llegó a regir.
            await tx.asignacionCampo.update({
              where: { id: a.id },
              data:
                a.fechaDesde >= fecha
                  ? { activo: false }
                  : { fechaHasta: anterior },
            });
            await tx.backupCampo.updateMany({
              where: {
                asignacionId: a.id,
                activo: true,
                fechaDesde: { gte: fecha },
              },
              data: { activo: false },
            });
            await tx.backupCampo.updateMany({
              where: {
                asignacionId: a.id,
                activo: true,
                fechaDesde: { lt: fecha },
                fechaHasta: { gte: fecha },
              },
              data: { fechaHasta: anterior },
            });
            // shortcut: el local principal se limpia ya, aunque el cambio rija desde la fecha elegida.
            await tx.usuario.updateMany({
              where: {
                id: deId,
                empresaId: u.empresaId,
                localPrincipalId: a.localId,
              },
              data: { localPrincipalId: null },
            });
            const yaLoAtiende = await tx.asignacionCampo.count({
              where: {
                empresaId: u.empresaId,
                localId: a.localId,
                usuarioId: aId,
                activo: true,
                fechaDesde: { lte: a.fechaHasta ?? new Date('9999-12-31') },
                OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
              },
            });
            if (yaLoAtiende) {
              omitidos.push({
                localId: a.localId,
                motivo: 'Ya lo atendía: solo se cerró la asignación anterior',
              });
              continue;
            }
            const nueva = await tx.asignacionCampo.create({
              data: {
                empresaId: u.empresaId,
                localId: a.localId,
                usuarioId: aId,
                fechaDesde: fecha,
                fechaHasta: a.fechaHasta,
              },
              select: { id: true },
            });
            // Franjas propias vigentes: el nuevo titular atiende con los mismos horarios.
            const franjas = await tx.horarioCampo.findMany({
              where: {
                asignacionId: a.id,
                activo: true,
                OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
              },
              select: {
                empresaId: true,
                localId: true,
                destinatario: true,
                equipoCampoId: true,
                frecuencia: true,
                intervalo: true,
                diasSemana: true,
                diasMes: true,
                fechaDesde: true,
                fechaHasta: true,
                entrada: true,
                salida: true,
              },
            });
            if (franjas.length)
              await tx.horarioCampo.createMany({
                data: franjas.map((h) => ({
                  ...h,
                  asignacionId: nueva.id,
                  fechaDesde: h.fechaDesde > fecha ? h.fechaDesde : fecha,
                })),
              });
            pasados++;
          }
          return pasados;
        };
        const pasados = await pasar(ida, dto.origenId, dto.destinoId);
        const intercambiados = await pasar(vuelta, dto.destinoId, dto.origenId);
        return {
          respuesta: { pasados, intercambiados, omitidos },
          locales: ida.map((a) => a.localId),
          localesIntercambio: vuelta.map((a) => a.localId),
        };
      },
      { isolationLevel: 'Serializable', timeout: 120_000, maxWait: 10_000 },
    );
    await this.auditoria?.registrar({
      accion: 'ASIGNAR',
      entidad: 'Asignación',
      entidadId: `traspaso ${dto.origenId}→${dto.destinoId}`,
      empresaId: u.empresaId,
      etiqueta: `Traspaso de locales desde ${dto.fecha}`,
      despues: {
        origenId: dto.origenId,
        destinoId: dto.destinoId,
        fecha: dto.fecha,
        locales: resultado.locales,
        localesIntercambio: resultado.localesIntercambio,
        omitidos: resultado.respuesta.omitidos,
      },
    });
    return resultado.respuesta;
  }
  async backups(
    usuarioId: number,
    asignacionId: number,
    query: ConsultaCampoDto,
  ) {
    await this.asignacionDelEquipo(usuarioId, asignacionId);
    const where = { asignacionId, activo: true };
    const { skip, take, page, limit } = rangoPaginacion(query);
    const [total, items] = await Promise.all([
      this.prisma.backupCampo.count({ where }),
      this.prisma.backupCampo.findMany({
        where,
        select: BACKUP_CAMPO_SELECT,
        orderBy: { fechaDesde: 'desc' },
        skip,
        take,
      }),
    ]);
    return respuestaPaginada(items, total, page, limit);
  }
  async crearBackup(
    usuarioId: number,
    asignacionId: number,
    dto: BackupCampoDto,
  ) {
    const { u, a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    await this.acceso.subordinado(u, dto.usuarioId);
    const fechas = vigenciaCampo(dto.fechaDesde, dto.fechaHasta);
    if (
      !fechas.fechaHasta ||
      dto.usuarioId === a.usuarioId ||
      fechas.fechaDesde < a.fechaDesde ||
      (a.fechaHasta && fechas.fechaHasta > a.fechaHasta)
    )
      throw new BadRequestException(
        'El backup debe ser otra persona y estar dentro de la vigencia del titular',
      );
    const hasta = fechas.fechaHasta;
    const backup = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campo_asignaciones WHERE id = ${asignacionId} FOR UPDATE`;
      if (
        await tx.backupCampo.count({
          where: {
            asignacionId,
            activo: true,
            fechaDesde: { lte: hasta },
            fechaHasta: { gte: fechas.fechaDesde },
          },
        })
      )
        throw new BadRequestException('Ya hay un backup para esas fechas');
      return tx.backupCampo.create({
        data: {
          asignacionId,
          usuarioId: dto.usuarioId,
          motivo: dto.motivo,
          fechaDesde: fechas.fechaDesde,
          fechaHasta: hasta,
        },
        select: BACKUP_CAMPO_SELECT,
      });
    });
    await this.auditoria?.registrar({
      accion: 'ASIGNAR',
      entidad: 'Backup',
      entidadId: backup.id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(backup.usuario)} cubre a ${nombrePersona(a.usuario)} · local ${a.localId}`,
      despues: backup,
    });
    return backup;
  }
  async quitarBackup(usuarioId: number, asignacionId: number, id: number) {
    const { u, a } = await this.asignacionDelEquipo(usuarioId, asignacionId);
    const [backup] = await this.prisma.backupCampo.updateManyAndReturn({
      where: { id, asignacionId },
      data: { activo: false },
      select: BACKUP_CAMPO_SELECT,
    });
    if (!backup) throw new NotFoundException('Backup no disponible');
    await this.auditoria?.registrar({
      accion: 'QUITAR',
      entidad: 'Backup',
      entidadId: id,
      empresaId: u.empresaId,
      etiqueta: `${nombrePersona(backup.usuario)} cubría a ${nombrePersona(a.usuario)} · local ${a.localId}`,
      antes: { ...backup, activo: true },
      despues: backup,
    });
    return { ok: true };
  }
}
