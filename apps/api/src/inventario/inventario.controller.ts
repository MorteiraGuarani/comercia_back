import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { CardCodePipe } from '../common/pipes/card-code.pipe';
import {
  AgregarProductosInventarioDto,
  BuscarInventarioDto,
  ConfiguracionInventarioDto,
  ConsultaInventarioLocalDto,
  GuardarCargasInventarioDto,
} from './dto/inventario-local.dto';
import { InventarioLocalService } from './inventario-local.service';

@ApiTags('Inventario por local')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a Mi jornada · Inventario' })
@Controller('campo/inventario')
@UseGuards(JwtAuthGuard)
export class InventarioController {
  constructor(private readonly servicio: InventarioLocalService) {}

  @Get('locales')
  @ApiOperation({ summary: 'Locales de la ruta del usuario, paginados' })
  locales(@Req() r: RequestConUsuario, @Query() q: BuscarInventarioDto) {
    return this.servicio.locales(r.usuarioId, q);
  }

  @Get('copia')
  @ApiOperation({
    summary:
      'Copia sin conexión: productos activos y locales de la ruta con su carga de hoy (sin paginar, con tope)',
  })
  @ApiPayloadTooLargeResponse({
    description: 'Supera el máximo que se guarda en el equipo',
  })
  copia(@Req() r: RequestConUsuario) {
    return this.servicio.copia(r.usuarioId);
  }

  @Get('productos')
  @ApiOperation({
    summary: 'Productos activos de tbl_oitm para agregar a un local',
  })
  productos(@Req() r: RequestConUsuario, @Query() q: BuscarInventarioDto) {
    return this.servicio.productos(r.usuarioId, q);
  }

  @Get('configuracion')
  @ApiOperation({
    summary: 'Días de aviso antes del vencimiento (PDV y rutas o superadmin)',
  })
  configuracion(@Req() r: RequestConUsuario) {
    return this.servicio.configuracion(r.usuarioId);
  }

  @Put('configuracion')
  @ApiOperation({ summary: 'Cambiar los días de aviso de la empresa' })
  guardarConfiguracion(
    @Req() r: RequestConUsuario,
    @Body() d: ConfiguracionInventarioDto,
  ) {
    return this.servicio.guardarConfiguracion(r.usuarioId, d);
  }

  @Get('locales/:localId')
  @ApiOperation({
    summary:
      'Inventario del local: hoy, productos y su carga; otra fecha, lo cargado ese día',
  })
  detalle(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Query() q: ConsultaInventarioLocalDto,
  ) {
    return this.servicio.detalle(r.usuarioId, localId, q);
  }

  @Post('locales/:localId/productos')
  @ApiOperation({ summary: 'Asociar productos al inventario del local' })
  agregarProductos(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Body() d: AgregarProductosInventarioDto,
  ) {
    return this.servicio.agregarProductos(r.usuarioId, localId, d);
  }

  @Delete('locales/:localId/productos/:itemcode')
  @ApiOperation({ summary: 'Quitar un producto del inventario del local' })
  quitarProducto(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Param('itemcode') itemcode: string,
  ) {
    return this.servicio.quitarProducto(r.usuarioId, localId, itemcode);
  }

  @Put('locales/:localId/cargas')
  @ApiOperation({
    summary:
      'Guardar la carga del día (hoy o, sin conexión, hasta 7 días atrás): cantidad y vencimiento',
  })
  guardarCargas(
    @Req() r: RequestConUsuario,
    @Param('localId', CardCodePipe) localId: string,
    @Body() d: GuardarCargasInventarioDto,
  ) {
    return this.servicio.guardarCargas(r.usuarioId, localId, d);
  }
}
