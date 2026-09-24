import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import type { Response } from 'express';
import { join, extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { CatalogoCampoService } from './catalogo-campo.service';
import { PlanificacionCampoService } from './planificacion-campo.service';
import { JornadaCampoService } from './jornada-campo.service';
import { ComentarioService } from './services/comentario.service';
import { FotoService } from './services/foto.service';
import { NotificacionService } from './services/notificacion.service';
import { NovedadService } from './services/novedad.service';
import { AvisoService } from './services/aviso.service';
import { SupervisionService } from './services/supervision.service';
import { AdjuntoCampoService } from './services/adjunto-campo.service';
import {
  AsignacionCampoDto,
  BackupCampoDto,
  ClienteCampoDto,
  ConsultaCampoDto,
  EntradaCampoDto,
  HorarioCampoDto,
  LocalCampoDto,
  MarcaCampoDto,
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
import {
  multerConfigAdjuntosCampo,
  multerConfigFotosTareas,
  multerConfigLogoCliente,
  directorioUploads,
  resolverRutaFoto,
} from './utils/multer-config';
import { createReadStream, existsSync } from 'fs';

@Controller('campo')
@UseGuards(JwtAuthGuard)
export class CampoController {
  constructor(
    private readonly catalogo: CatalogoCampoService,
    private readonly plan: PlanificacionCampoService,
    private readonly jornada: JornadaCampoService,
    private readonly comentarioService: ComentarioService,
    private readonly fotoService: FotoService,
    private readonly notificacionService: NotificacionService,
    private readonly novedadService: NovedadService,
    private readonly avisoService: AvisoService,
    private readonly supervisionService: SupervisionService,
    private readonly adjuntoCampoService: AdjuntoCampoService,
  ) {}

  @Get('clientes') clientes(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.clientes(r.usuarioId, q);
  }
  @Post('clientes') crearCliente(
    @Req() r: RequestConUsuario,
    @Body() d: ClienteCampoDto,
  ) {
    return this.catalogo.guardarCliente(r.usuarioId, d);
  }
  @Put('clientes/:id') editarCliente(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ClienteCampoDto,
  ) {
    return this.catalogo.guardarCliente(r.usuarioId, d, id);
  }
  @Delete('clientes/:id') eliminarCliente(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.eliminarCliente(r.usuarioId, id);
  }

  @Post('clientes/subir-logo')
  @UseInterceptors(FileInterceptor('logo', multerConfigLogoCliente))
  subirLogoCliente(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se envió archivo de imagen');
    }
    return { url: `/api/v1/campo/clientes/logos/${file.filename}` };
  }

  @Get('clientes/logos/:filename')
  servirLogoCliente(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const rutaPersistida = join(directorioUploads(), 'clientes', safeName);
    const ruta = existsSync(rutaPersistida)
      ? rutaPersistida
      : join(process.cwd(), 'uploads', 'clientes', safeName);
    if (!existsSync(ruta)) {
      return res.status(404).json({ message: 'Logo no encontrado' });
    }
    const ext = extname(safeName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    const stream = createReadStream(ruta);
    stream.pipe(res);
  }

  @Get('locales') locales(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.catalogo.locales(r.usuarioId, q);
  }
  @Post('locales') crearLocal(
    @Req() r: RequestConUsuario,
    @Body() d: LocalCampoDto,
  ) {
    return this.catalogo.guardarLocal(r.usuarioId, d);
  }
  @Put('locales/:id') editarLocal(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: LocalCampoDto,
  ) {
    return this.catalogo.guardarLocal(r.usuarioId, d, id);
  }
  @Delete('locales/:id') eliminarLocal(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.catalogo.eliminarLocal(r.usuarioId, id);
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

  @Get('equipo') equipo(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.equipo(r.usuarioId, q);
  }
  @Get('locales/:localId/horarios') horarios(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.horarios(r.usuarioId, id, q);
  }
  @Post('locales/:localId/horarios') crearHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) id: number,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorario(r.usuarioId, id, d);
  }
  @Put('locales/:localId/horarios/:id') editarHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) localId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: HorarioCampoDto,
  ) {
    return this.plan.guardarHorario(r.usuarioId, localId, d, id);
  }
  @Delete('locales/:localId/horarios/:id') eliminarHorario(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) localId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.plan.eliminarHorario(r.usuarioId, localId, id);
  }

  @Get('locales/:localId/asignaciones') asignaciones(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.plan.asignaciones(r.usuarioId, id, q);
  }
  @Post('locales/:localId/asignaciones') asignar(
    @Req() r: RequestConUsuario,
    @Param('localId', ParseIntPipe) id: number,
    @Body() d: AsignacionCampoDto,
  ) {
    return this.plan.asignar(r.usuarioId, id, d);
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
  @Get('jornada/visitas') misVisitas(
    @Req() r: RequestConUsuario,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.visitas(r.usuarioId, q);
  }
  @Get('jornada/asignaciones/:id/tareas') tareasJornada(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ConsultaCampoDto,
  ) {
    return this.jornada.tareas(r.usuarioId, id, q);
  }
  @Post('jornada/entrada') entrada(
    @Req() r: RequestConUsuario,
    @Body() d: EntradaCampoDto,
  ) {
    return this.jornada.entrada(r.usuarioId, d);
  }
  @Post('jornada/visitas/:id/salida') salida(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: MarcaCampoDto,
  ) {
    return this.jornada.salida(r.usuarioId, id, d);
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

    res.setHeader('Content-Type', foto.mimeType);
    res.setHeader('Content-Length', foto.tamanioBytes);

    const stream = createReadStream(rutaFoto);
    stream.pipe(res);
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

    res.setHeader('Content-Type', adjunto.mimeType);
    res.setHeader('Content-Length', String(adjunto.tamanioBytes));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    createReadStream(adjunto.rutaArchivo).pipe(res);
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
