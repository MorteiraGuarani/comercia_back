import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { CatalogoCampoService } from './catalogo-campo.service';
import { CardCodePipe } from '../common/pipes/card-code.pipe';
import { LocalPrincipalCampoDto } from './dto/local-principal.dto';
import { CrearLocalCampoDto, EditarLocalCampoDto } from './dto/crear-local.dto';
import { PlanificacionCampoService } from './planificacion-campo.service';
import { JornadaCampoService } from './jornada-campo.service';
import { RepositorCampoService } from './repositor-campo.service';
import { ComentarioService } from './services/comentario.service';
import { FotoService } from './services/foto.service';
import { NotificacionService } from './services/notificacion.service';
import { NovedadService } from './services/novedad.service';
import { AvisoService } from './services/aviso.service';
import { OrganigramaService } from './services/organigrama.service';
import { ConsultaOrganigramaDto } from './dto/organigrama.dto';
import { SupervisionService } from './services/supervision.service';
import { AdjuntoCampoService } from './services/adjunto-campo.service';
import { CampoAccesoService } from './campo-acceso.service';
import { ConsultaLocalesCampoDto } from './dto/administracion.dto';
import {
  ElegirEquipoGestionDto,
  ListarEquiposGestionDto,
} from './dto/equipo-gestion.dto';
import {
  AsignacionCampoDto,
  BackupCampoDto,
  ConsultaCampoDto,
  ConsultaLocalesEmpresaDto,
  EntradaCampoDto,
  EntradaRepositorCampoDto,
  HorarioCampoDto,
  MarcaCampoDto,
  MarcaRepositorCampoDto,
  TareaCampoDto,
} from './dto/campo.dto';
import { CrearComentarioTareaDto } from './dto/comentario-tarea.dto';
import { MomentoFotoDto, SubirFotoTareaDto } from './dto/foto-tarea.dto';
import { ListarNotificacionesDto } from './dto/notificacion.dto';
import {
  ActualizarEstadoNovedadDto,
  CrearNovedadDto,
  ListarNovedadesDto,
  ResponderNovedadDto,
} from './dto/novedad.dto';
import { ConsultaAvisosDto, CrearAvisoDto } from './dto/aviso.dto';
import { ConsultaSupervisionDto } from './dto/supervision.dto';
import { ConsultaTareasCampoDto } from './dto/consulta-tareas.dto';
import { ConsultaTareasDiaDto } from './dto/consulta-tareas-dia.dto';
import {
  multerConfigAdjuntosCampo,
  multerConfigFotosTareas,
  resolverRutaFoto,
} from './utils/multer-config';
import { existsSync } from 'fs';
import { enviarArchivo } from '../common/utils/enviar-archivo';

@Controller('campo')
@UseGuards(JwtAuthGuard)
export class CampoController {
  constructor(
    private readonly catalogo: CatalogoCampoService,
    private readonly plan: PlanificacionCampoService,
    private readonly jornada: JornadaCampoService,
    private readonly repositor: RepositorCampoService,
    private readonly comentarioService: ComentarioService,
    private readonly fotoService: FotoService,
    private readonly notificacionService: NotificacionService,
    private readonly novedadService: NovedadService,
    private readonly avisoService: AvisoService,
    private readonly supervisionService: SupervisionService,
    private readonly organigramaService: OrganigramaService,
    private readonly adjuntoCampoService: AdjuntoCampoService,
    private readonly acceso: CampoAccesoService,
  ) {}

  @Get('equipos-gestion')
  @ApiOperation({
    summary: 'Equipos que supervisa la jefatura',
    description:
      'Solo roles de jefatura (jefe de canal, back office de canal, gerencia), configurados en Roles con "Supervisa varios equipos"; el resto recibe 403. Lista paginada y buscable por nombre: { id, nombre, tipo, activo }.',
  })
  equiposGestion(
    @Req() r: RequestConUsuario,
    @Query() q: ListarEquiposGestionDto,
  ) {
    return this.acceso.equiposGestion(r.usuarioId, q);
  }

  @Put('equipos-gestion/activo')
  @ApiOperation({
    summary: 'Elegir con qué equipo trabaja la jefatura',
    description:
      'equipoId debe ser uno de sus equipos (403 si no); null vuelve a todos. Desempeño, Inicio y Ubicaciones muestran el elegido o todos juntos; las pantallas que administran (tareas, locales, horarios) exigen haber elegido uno. Responde { equipo }.',
  })
  elegirEquipoGestion(
    @Req() r: RequestConUsuario,
    @Body() dto: ElegirEquipoGestionDto,
  ) {
    return this.acceso.elegirEquipoGestion(r.usuarioId, dto.equipoId);
  }

  @Get('locales/mapa') localesMapa(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.localesMapa(r.usuarioId, q);
  }
  @Get('locales/colaboradores')
  @ApiOperation({
    summary: 'Repositores o impulsadores para filtrar locales',
    description:
      'Requiere acceso a PDV y rutas. Lista paginada y buscable (nombre, apellido, usuario, legajo o código ERP de repositor/impulsador) de quienes atienden hoy algún local dentro del alcance del Itinerario: supervisores y team leaders ven solo su equipo. Responde { id, nombre, descripcion: rol, codigo }.',
  })
  colaboradoresLocales(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.colaboradoresLocales(r.usuarioId, q);
  }
  @Get('locales')
  @ApiOperation({
    summary: 'Locales del Itinerario',
    description:
      'Paginado y buscable. usuarioId filtra los locales que esa persona atiende hoy y localId (CardCode) uno solo; ambos dentro del alcance del Itinerario. Con lat y lng ordena del más cercano al más lejano (los que no tienen ubicación, al final); 413 si el alcance supera 2000 locales.',
  })
  locales(@Req() r: RequestConUsuario, @Query() q: ConsultaLocalesCampoDto) {
    return this.catalogo.locales(r.usuarioId, q);
  }
  // Solo superadmin: locales de cualquier empresa (pestaña Locales de Administración).
  @Get('superadmin/locales')
  @UseGuards(SuperadminGuard)
  @ApiOperation({
    summary: 'Locales de una empresa (superadmin)',
    description:
      'Socios de negocio de la empresa elegida con dirección, ubicación y quién los atiende hoy. Paginado; admite buscar por nombre o CardCode.',
  })
  localesEmpresa(@Query() q: ConsultaLocalesEmpresaDto) {
    return this.catalogo.localesEmpresa(q.empresaId, q);
  }
  @Post('locales') crearLocal(
    @Req() r: RequestConUsuario,
    @Body() d: CrearLocalCampoDto,
  ) {
    return this.catalogo.crearLocal(r.usuarioId, d);
  }

  @Put('locales/:localId') editarLocal(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) id: string,
    @Body() d: EditarLocalCampoDto,
  ) {
    return this.catalogo.editarLocal(r.usuarioId, id, d);
  }

  @Get('tareas') tareas(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaTareasCampoDto,
  ) {
    return this.catalogo.tareas(r.usuarioId, q);
  }
  @Post('tareas') crearTarea(
    @Req() r: RequestConUsuario,
    @Body() d: TareaCampoDto,
  ) {
    return this.catalogo.guardarTarea(r.usuarioId, d);
  }

  @Get('tareas/:id/versiones') versionesTarea(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.versionesTarea(r.usuarioId, id, q);
  }

  @Get('tareas/:id/locales') localesTarea(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.localesTarea(r.usuarioId, id, q);
  }
  @Put('tareas/:id') editarTarea(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: TareaCampoDto,
  ) {
    return this.catalogo.guardarTarea(r.usuarioId, d, id);
  }
  @Delete('tareas/:id') eliminarTarea(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.eliminarTarea(r.usuarioId, id);
  }

  @Get('equipo')
  @ApiOperation({
    summary: 'Personal disponible para la planificación',
    description:
      'Requiere acceso a PDV y rutas. Lista paginada y buscable del personal activo de la misma empresa y del mismo equipo operativo, sin exigir una relación de superior en el organigrama. Las asignaciones conservan las validaciones de acceso a la jornada, vigencia y solapamiento.',
  })
  equipo(@Req() r: RequestConUsuario, @Query() q: ConsultaCampoDto) {
    return this.plan.equipo(r.usuarioId, q);
  }
  @Get('locales/:localId/horarios') horarios(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) id: string,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.horarios(r.usuarioId, id, q);
  }
  @Post('locales/:localId/horarios') crearHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) id: string,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorario(r.usuarioId, id, d);
  }
  @Put('locales/:localId/horarios/:id') editarHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorario(r.usuarioId, localId, d, id);
  }
  @Delete('locales/:localId/horarios/:id') eliminarHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plan.eliminarHorario(r.usuarioId, localId, id);
  }

  @Get('locales/:localId/asignaciones') asignaciones(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) id: string,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.asignaciones(r.usuarioId, id, q);
  }
  @Get('asignaciones/:id/horarios') horariosAsignacion(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.horariosAsignacion(r.usuarioId, id, q);
  }
  @Post('asignaciones/:id/horarios') crearHorarioAsignacion(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorarioAsignacion(r.usuarioId, id, d);
  }
  @Put('asignaciones/:id/horarios/:horarioId') editarHorarioAsignacion(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('horarioId', ParseIntPipe) horarioId: number,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorarioAsignacion(r.usuarioId, id, d, horarioId);
  }
  @Delete('asignaciones/:id/horarios/:horarioId') eliminarHorarioAsignacion(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('horarioId', ParseIntPipe) horarioId: number,
  ) {
    return this.plan.eliminarHorarioAsignacion(r.usuarioId, id, horarioId);
  }
  @Post('locales/:localId/asignaciones') asignar(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) id: string,
    @Body() d: AsignacionCampoDto,
  ) {
    return this.plan.asignar(r.usuarioId, id, d);
  }
  @Put('asignaciones/:id/principal')
  localPrincipal(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: LocalPrincipalCampoDto,
  ) {
    return this.plan.localPrincipal(r.usuarioId, id, d.principal);
  }
  @Delete('asignaciones/:id') quitarAsignacion(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plan.quitarAsignacion(r.usuarioId, id);
  }
  @Get('asignaciones/:id/backups') backups(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.backups(r.usuarioId, id, q);
  }
  @Post('asignaciones/:id/backups') crearBackup(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: BackupCampoDto,
  ) {
    return this.plan.crearBackup(r.usuarioId, id, d);
  }
  @Delete('asignaciones/:asignacionId/backups/:id') quitarBackup(
    @Req() r: RequestConUsuario,
    @Param('asignacionId', ParseIntPipe) asignacionId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plan.quitarBackup(r.usuarioId, asignacionId, id);
  }
  @Get('visitas') visitas(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.visitas(r.usuarioId, q, true);
  }

  @Get('jornada') agenda(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.agenda(r.usuarioId, q);
  }
  @Get('jornada/abierta') abierta(@Req() r: RequestConUsuario) {
    return this.jornada.abierta(r.usuarioId);
  }

  @Get('jornada/repositor/telefono') estadoTelefono(
    @Req() r: RequestConUsuario,
  ) {
    return this.repositor.estadoTelefono(r.usuarioId);
  }

  @Get('jornada/repositor/operaciones/:id') estadoOperacion(
    @Req() r: RequestConUsuario,
    @Param('id') id: string,
  ) {
    return this.repositor.estadoOperacion(r.usuarioId, id);
  }

  @Post('jornada/visitas/:visitaId/tareas/:tareaId/iniciar') iniciarTarea(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
  ) {
    return this.jornada.iniciarTarea(r.usuarioId, visitaId, tareaId);
  }
  @Get('jornada/visitas') misVisitas(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.visitas(r.usuarioId, q);
  }
  @Get('jornada/tareas') tareasDelDia(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaTareasDiaDto,
  ) {
    return this.jornada.tareasDelDia(r.usuarioId, q);
  }
  @Get('jornada/asignaciones/:id/tareas') tareasJornada(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.tareas(r.usuarioId, id, q);
  }
  @Post('jornada/entrada') async entrada(
    @Req() r: RequestConUsuario,
    @Body() d: EntradaCampoDto,
  ) {
    return (await this.repositor.esRepositor(r.usuarioId))
      ? this.repositor.entrada(r.usuarioId, d)
      : this.repositor.entradaWeb(r.usuarioId, d);
  }
  @Post('jornada/repositor/entrada') entradaRepositor(
    @Req() r: RequestConUsuario,
    @Body() d: EntradaRepositorCampoDto,
  ) {
    return this.repositor.entrada(r.usuarioId, d);
  }
  @Post('jornada/visitas/:id/salida') async salida(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: MarcaCampoDto,
  ) {
    if (await this.repositor.esRepositor(r.usuarioId))
      return this.repositor.salida(r.usuarioId, id, d);
    // Las visitas abiertas antes de marcar vía Ucheck se cierran en Comercia.
    return (
      (await this.repositor.salidaWeb(r.usuarioId, id, d)) ??
      this.jornada.salida(r.usuarioId, id, d)
    );
  }
  @Post('jornada/repositor/visitas/:id/salida') salidaRepositor(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: MarcaRepositorCampoDto,
  ) {
    return this.repositor.salida(r.usuarioId, id, d);
  }
  @Post('jornada/visitas/:visitaId/tareas/:tareaId') completar(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
  ) {
    return this.jornada.completar(r.usuarioId, visitaId, tareaId);
  }

  // ========== COMENTARIOS ==========

  @Post('jornada/visitas/:visitaId/tareas/:tareaId/comentarios')
  crearComentario(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Body() dto: CrearComentarioTareaDto,
  ) {
    return this.comentarioService.crear(
      r.usuarioId,
      r.empresaId,
      visitaId,
      tareaId,
      dto,
    );
  }

  @Get('jornada/visitas/:visitaId/tareas/:tareaId/comentarios')
  listarComentarios(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
  ) {
    return this.comentarioService.listar(r.usuarioId, visitaId, tareaId);
  }

  @Get('jornada/comentarios/:id')
  @ApiOperation({
    summary: 'Ubicar un comentario de tarea',
    description:
      'Visita y tarea del comentario, para abrir su hilo desde la notificación. Solo el dueño de la visita o su líder.',
  })
  ubicarComentario(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comentarioService.ubicar(r.usuarioId, id);
  }

  @Put('jornada/comentarios/:id/marcar-leido')
  marcarComentarioLeido(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.comentarioService.marcarLeido(r.usuarioId, id);
  }

  // ========== FOTOS ==========

  @Post('jornada/visitas/:visitaId/tareas/:tareaId/fotos')
  @UseInterceptors(FileInterceptor('foto', multerConfigFotosTareas))
  subirFoto(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Body() dto: SubirFotoTareaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.fotoService.subir(
      r.usuarioId,
      r.empresaId,
      visitaId,
      tareaId,
      dto.momento,
      file,
      dto.operacionId,
    );
  }

  @Get('jornada/visitas/:visitaId/tareas/:tareaId/fotos')
  obtenerFotos(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
  ) {
    return this.fotoService.obtener(r.usuarioId, visitaId, tareaId);
  }

  @Get('fotos/:id')
  async servirFoto(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const foto = await this.fotoService.obtenerPorId(
      r.usuarioId,
      r.empresaId,
      id,
    );

    const rutaFoto = foto ? resolverRutaFoto(foto.rutaArchivo) : null;
    if (!foto || !rutaFoto || !existsSync(rutaFoto)) {
      return res.status(404).json({ message: 'Foto no encontrada' });
    }

    enviarArchivo(res, rutaFoto, {
      'Content-Type': foto.mimeType,
      'Content-Length': String(foto.tamanioBytes),
    });
  }

  @Delete('jornada/visitas/:visitaId/tareas/:tareaId/fotos/:momento')
  eliminarFoto(
    @Req() r: RequestConUsuario,
    @Param('visitaId', ParseIntPipe) visitaId: number,
    @Param('tareaId', ParseIntPipe) tareaId: number,
    @Param('momento') momento: MomentoFotoDto,
  ) {
    return this.fotoService.eliminar(r.usuarioId, visitaId, tareaId, momento);
  }

  // ========== NOTIFICACIONES ==========

  @Get('notificaciones')
  listarNotificaciones(
    @Req() r: RequestConUsuario,
    @Query() dto: ListarNotificacionesDto,
  ) {
    return this.notificacionService.listar(r.usuarioId, dto);
  }

  @Put('notificaciones/:id/marcar-leida')
  marcarNotificacionLeida(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificacionService.marcarLeida(r.usuarioId, id);
  }

  @Put('notificaciones/marcar-todas-leidas')
  marcarTodasNotificacionesLeidas(@Req() r: RequestConUsuario) {
    return this.notificacionService.marcarTodasLeidas(r.usuarioId);
  }

  @Get('notificaciones/contador-no-leidas')
  contadorNotificacionesNoLeidas(@Req() r: RequestConUsuario) {
    return this.notificacionService.contadorNoLeidas(r.usuarioId);
  }

  @Get('notificaciones/:id/inventario')
  @ApiOperation({
    summary:
      'Detalle completo de la carga de inventario de una notificación propia',
    description:
      'Incluye producto, local, dirección, cantidad, vencimiento, autor y fechas de carga. Solo para el destinatario de la misma empresa; no exige acceso de edición al inventario.',
  })
  detalleNotificacionInventario(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificacionService.detalleInventario(
      r.usuarioId,
      r.empresaId,
      id,
    );
  }

  // ========== SUPERVISIÓN Y PRESENTISMO ==========

  @Get('supervision/resumen')
  resumenSupervision(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaSupervisionDto,
  ) {
    return this.supervisionService.resumen(r.usuarioId, q);
  }

  @Get('supervision/colaboradores/:id')
  detalleColaborador(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaSupervisionDto,
  ) {
    return this.supervisionService.detalleColaborador(r.usuarioId, id, q);
  }

  @Get('supervision/colaboradores/:id/marcaciones')
  @Header('Cache-Control', 'private, no-store')
  marcacionesColaborador(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaSupervisionDto,
  ) {
    return this.supervisionService.marcacionesColaborador(r.usuarioId, id, q);
  }

  // ========== JEFATURA: AVANCE DE TODO EL ORGANIGRAMA ==========

  @Get('jefatura/resumen')
  @ApiOperation({
    summary:
      'Requiere la página Avance del módulo Jefatura. Los mismos indicadores de supervisión, sumando a toda la cadena del jefe en el organigrama (cualquier rol con equipo operativo) y al personal de los equipos que supervisa.',
  })
  resumenJefatura(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaSupervisionDto,
  ) {
    return this.supervisionService.resumen(r.usuarioId, q, 'jefatura');
  }

  @Get('jefatura/colaboradores/:id')
  detalleColaboradorJefatura(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaSupervisionDto,
  ) {
    return this.supervisionService.detalleColaborador(
      r.usuarioId,
      id,
      q,
      'jefatura',
    );
  }

  @Get('organigrama')
  @Header('Cache-Control', 'private, no-store')
  organigrama(@Req() r: RequestConUsuario, @Query() q: ConsultaOrganigramaDto) {
    return this.organigramaService.organigrama(r.usuarioId, q);
  }

  // ========== NOVEDADES ==========

  @Post('novedades')
  @UseInterceptors(FilesInterceptor('fotos', 5, multerConfigAdjuntosCampo))
  crearNovedad(
    @Req() r: RequestConUsuario,
    @Body() d: CrearNovedadDto,
    @UploadedFiles() fotos: Express.Multer.File[] = [],
  ) {
    return this.novedadService.crear(r.usuarioId, r.empresaId, d, fotos);
  }

  @Get('novedades')
  listarNovedades(@Req() r: RequestConUsuario, @Query() q: ListarNovedadesDto) {
    return this.novedadService.listar(r.usuarioId, r.empresaId, q);
  }

  @Get('novedades/locales')
  localesNovedad(@Req() r: RequestConUsuario, @Query() q: ConsultaCampoDto) {
    return this.novedadService.locales(r.usuarioId, r.empresaId, q);
  }

  @Get('novedades/:id')
  obtenerNovedad(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.novedadService.obtenerPorId(r.usuarioId, r.empresaId, id);
  }

  @Get('novedades/:id/respuestas')
  listarRespuestasNovedad(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.novedadService.listarRespuestas(
      r.usuarioId,
      r.empresaId,
      id,
      q,
    );
  }

  @Post('novedades/:id/respuestas')
  responderNovedad(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ResponderNovedadDto,
  ) {
    return this.novedadService.responder(r.usuarioId, r.empresaId, id, d);
  }

  @Put('novedades/:id/estado')
  actualizarEstadoNovedad(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ActualizarEstadoNovedadDto,
  ) {
    return this.novedadService.actualizarEstado(r.usuarioId, id, d);
  }

  // ========== AVISOS ==========

  @Post('avisos')
  @UseInterceptors(FilesInterceptor('fotos', 5, multerConfigAdjuntosCampo))
  crearAviso(
    @Req() r: RequestConUsuario,
    @Body() d: CrearAvisoDto,
    @UploadedFiles() fotos: Express.Multer.File[] = [],
  ) {
    return this.avisoService.crear(r.usuarioId, r.empresaId, d, fotos);
  }

  @Get('adjuntos/:id')
  async obtenerAdjunto(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const adjunto = await this.adjuntoCampoService.obtenerArchivo(
      r.usuarioId,
      r.empresaId,
      id,
    );
    if (!existsSync(adjunto.rutaArchivo)) {
      throw new NotFoundException('El archivo adjunto no está disponible');
    }

    enviarArchivo(res, adjunto.rutaArchivo, {
      'Content-Type': adjunto.mimeType,
      'Content-Length': String(adjunto.tamanioBytes),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    });
  }

  @Get('avisos/enviados')
  listarAvisosEnviados(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.avisoService.listarEnviados(r.usuarioId, r.empresaId, q);
  }

  @Get('avisos/destinatarios')
  listarDestinatariosAviso(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaAvisosDto,
  ) {
    return this.avisoService.listarDestinatarios(r.usuarioId, r.empresaId, q);
  }

  @Get('avisos/programaciones')
  listarProgramacionesAviso(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaAvisosDto,
  ) {
    return this.avisoService.listarProgramaciones(r.usuarioId, r.empresaId, q);
  }

  @Delete('avisos/programaciones/:id')
  cancelarProgramacionAviso(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.avisoService.cancelarProgramacion(r.usuarioId, r.empresaId, id);
  }

  @Get('avisos/recibidos')
  listarAvisosRecibidos(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.avisoService.listarRecibidos(r.usuarioId, r.empresaId, q);
  }

  @Get('avisos/:id')
  obtenerAviso(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.avisoService.obtenerPorId(r.usuarioId, r.empresaId, id);
  }

  @Put('avisos/:id/marcar-leido')
  marcarAvisoLeido(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.avisoService.marcarLeido(r.usuarioId, r.empresaId, id);
  }
}
