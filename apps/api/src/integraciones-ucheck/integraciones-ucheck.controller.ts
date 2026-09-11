import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AgendaUcheckDto } from './dto/agenda-ucheck.dto';
import { MarcacionUcheckDto } from './dto/marcacion-ucheck.dto';
import { IntegracionesUcheckService } from './integraciones-ucheck.service';
import { UcheckIntegracionGuard } from './ucheck-integracion.guard';

// Autenticación servidor-a-servidor. Este controlador nunca acepta el JWT móvil.
@Controller('integraciones/ucheck')
@UseGuards(UcheckIntegracionGuard)
export class IntegracionesUcheckController {
  constructor(private readonly servicio: IntegracionesUcheckService) {}

  @Get('salud')
  salud() {
    return { ok: true, servicio: 'comercia-ucheck' };
  }

  @Get('agenda')
  agenda(@Query() query: AgendaUcheckDto) {
    return this.servicio.agenda(query);
  }

  @Post('marcaciones')
  marcacion(@Body() dto: MarcacionUcheckDto) {
    return this.servicio.registrarMarcacion(dto);
  }
}
