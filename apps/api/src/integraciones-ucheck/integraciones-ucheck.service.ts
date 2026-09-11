import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CampoAccesoService } from '../campo/campo-acceso.service';
import { JornadaCampoService } from '../campo/jornada-campo.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaUcheckDto } from './dto/agenda-ucheck.dto';
import { MarcacionUcheckDto } from './dto/marcacion-ucheck.dto';

function correoNormalizado(correo: string) {
  return correo.trim().toLowerCase();
}

function fechaSql(fecha: string) {
  const resultado = new Date(`${fecha}T00:00:00.000Z`);
  if (
    !Number.isFinite(resultado.getTime()) ||
    resultado.toISOString().slice(0, 10) !== fecha
  )
    throw new BadRequestException('Fecha inválida');
  return resultado;
}

@Injectable()
export class IntegracionesUcheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accesoCampo: CampoAccesoService,
    private readonly jornadaCampo: JornadaCampoService,
  ) {}

  private async usuarioPorCorreo(correo: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        correo: { equals: correoNormalizado(correo), mode: 'insensitive' },
        isActive: true,
        esSuperadmin: false,
      },
      select: {
        id: true,
        empresaId: true,
        correo: true,
        nombre: true,
        apellido: true,
        empresa: { select: { id: true, nombre: true } },
      },
    });
    if (!usuario)
      throw new NotFoundException(
        'El correo no corresponde a un usuario activo de Comercia',
      );
    await this.accesoCampo.ejecutar(usuario.id);
    return usuario;
  }

  async agenda(query: AgendaUcheckDto) {
    const usuario = await this.usuarioPorCorreo(query.correo);
    const pagina = await this.jornadaCampo.agenda(usuario.id, {
      fecha: query.fecha,
      page: query.page,
      limit: query.limit,
    });
    return {
      usuario: {
        id: usuario.id,
        correo: correoNormalizado(usuario.correo),
        nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
      },
      empresa: usuario.empresa,
      ...pagina,
    };
  }

  async registrarMarcacion(dto: MarcacionUcheckDto) {
    const repetido = await this.prisma.integracionUcheckEvento.findFirst({
      where: {
        OR: [
          { id: dto.eventoId },
          { ucheckJornadaId: dto.ucheckJornadaId, tipo: dto.tipo },
        ],
      },
      select: { id: true, visitaId: true },
    });
    if (repetido)
      return {
        ok: true,
        duplicado: true,
        eventoId: repetido.id,
        visitaId: repetido.visitaId,
      };

    const usuario = await this.usuarioPorCorreo(dto.correoUsuario);
    const fecha = fechaSql(dto.fecha);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${dto.ucheckJornadaId})`;
      const existente = await tx.integracionUcheckEvento.findFirst({
        where: {
          OR: [
            { id: dto.eventoId },
            { ucheckJornadaId: dto.ucheckJornadaId, tipo: dto.tipo },
          ],
        },
        select: { id: true, visitaId: true },
      });
      if (existente)
        return {
          ok: true,
          duplicado: true,
          eventoId: existente.id,
          visitaId: existente.visitaId,
        };

      const asignacion = await tx.asignacionCampo.findFirst({
        where: {
          id: dto.asignacionId,
          localId: dto.localId,
          fechaDesde: { lte: fecha },
          OR: [{ fechaHasta: null }, { fechaHasta: { gte: fecha } }],
          local: { cliente: { empresaId: usuario.empresaId } },
          AND: [
            {
              OR: [
                { usuarioId: usuario.id },
                {
                  backups: {
                    some: {
                      usuarioId: usuario.id,
                      fechaDesde: { lte: fecha },
                      fechaHasta: { gte: fecha },
                    },
                  },
                },
              ],
            },
          ],
        },
        select: { id: true, localId: true, usuarioId: true },
      });
      if (!asignacion)
        throw new NotFoundException(
          'La asignación no corresponde al usuario, local y fecha informados',
        );

      if (dto.horarioId) {
        const horario = await tx.horarioCampo.findFirst({
          where: { id: dto.horarioId, localId: dto.localId },
          select: { id: true },
        });
        if (!horario)
          throw new NotFoundException('El horario no corresponde al local');
      }

      let visita = await tx.visitaCampo.findFirst({
        where: { ucheckJornadaId: dto.ucheckJornadaId },
        select: { id: true, entrada: true, salida: true },
      });

      if (dto.tipo === 'ENTRADA') {
        if (!visita) {
          visita = await tx.visitaCampo.findFirst({
            where: {
              asignacionId: asignacion.id,
              horarioId: dto.horarioId ?? null,
              fecha,
              usuarioId: usuario.id,
            },
            select: { id: true, entrada: true, salida: true },
          });
        }
        if (visita?.salida)
          throw new ConflictException('La visita ya se encuentra cerrada');
        visita = visita
          ? await tx.visitaCampo.update({
              where: { id: visita.id },
              data: {
                origen: 'UCHECK',
                ucheckJornadaId: dto.ucheckJornadaId,
                entrada: new Date(dto.registradaEn),
                entradaLat: dto.latitud,
                entradaLng: dto.longitud,
                entradaPrecision: dto.precisionMetros,
                entradaDistancia: dto.distanciaMetros,
                entradaFueraHorario: dto.fueraHorario,
                entradaFueraAtencion: dto.fueraAtencion,
              },
              select: { id: true, entrada: true, salida: true },
            })
          : await tx.visitaCampo.create({
              data: {
                localId: dto.localId,
                asignacionId: asignacion.id,
                usuarioId: usuario.id,
                horarioId: dto.horarioId ?? null,
                fecha,
                entrada: new Date(dto.registradaEn),
                esBackup: asignacion.usuarioId !== usuario.id,
                origen: 'UCHECK',
                ucheckJornadaId: dto.ucheckJornadaId,
                entradaLat: dto.latitud,
                entradaLng: dto.longitud,
                entradaPrecision: dto.precisionMetros,
                entradaDistancia: dto.distanciaMetros,
                entradaFueraHorario: dto.fueraHorario,
                entradaFueraAtencion: dto.fueraAtencion,
              },
              select: { id: true, entrada: true, salida: true },
            });
      } else {
        if (!visita)
          throw new ConflictException(
            'La entrada de esta jornada todavía no llegó a Comercia',
          );
        if (new Date(dto.registradaEn) < visita.entrada)
          throw new BadRequestException(
            'La salida no puede ser anterior a la entrada',
          );
        visita = await tx.visitaCampo.update({
          where: { id: visita.id },
          data: {
            salida: new Date(dto.registradaEn),
            salidaLat: dto.latitud,
            salidaLng: dto.longitud,
            salidaPrecision: dto.precisionMetros,
            salidaDistancia: dto.distanciaMetros,
            salidaFueraHorario: dto.fueraHorario,
            salidaFueraAtencion: dto.fueraAtencion,
          },
          select: { id: true, entrada: true, salida: true },
        });
      }

      await tx.integracionUcheckEvento.create({
        data: {
          id: dto.eventoId,
          tipo: dto.tipo,
          ucheckJornadaId: dto.ucheckJornadaId,
          usuarioId: usuario.id,
          empresaId: usuario.empresaId,
          visitaId: visita.id,
          localId: dto.localId,
          asignacionId: dto.asignacionId,
          horarioId: dto.horarioId ?? null,
          correoUsuario: correoNormalizado(dto.correoUsuario),
          registradaEn: new Date(dto.registradaEn),
          capturadaEn: new Date(dto.capturadaEn),
          latitud: dto.latitud,
          longitud: dto.longitud,
          precisionMetros: dto.precisionMetros,
          distanciaMetros: dto.distanciaMetros,
          centroLatitud: dto.centroLatitud,
          centroLongitud: dto.centroLongitud,
          radioMetros: dto.radioMetros,
          horaDesde: dto.horaDesde ?? null,
          horaHasta: dto.horaHasta ?? null,
          fueraHorario: dto.fueraHorario,
          fueraAtencion: dto.fueraAtencion,
          ubicacionSimulada: dto.ubicacionSimulada,
          contextoDispositivo: dto.contextoDispositivo
            ? (dto.contextoDispositivo as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
      return {
        ok: true,
        duplicado: false,
        eventoId: dto.eventoId,
        visitaId: visita.id,
      };
    });
  }
}
