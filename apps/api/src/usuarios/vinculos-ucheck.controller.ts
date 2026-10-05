import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { VinculosUcheckService } from './vinculos-ucheck.service';
import { VinculoUcheckDto } from './dto/vinculo-ucheck.dto';

@Controller('admin/usuarios-ucheck')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class VinculosUcheckController {
  constructor(private readonly vinculos: VinculosUcheckService) {}
  @Get(':id') consultar(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vinculos.consultar(r.usuarioId, id);
  }
  @Post(':id') vincular(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: VinculoUcheckDto,
  ) {
    return this.vinculos.vincular(r.usuarioId, id, d.ucheckUsuarioId);
  }
  @Delete(':id') desvincular(
    @Req() r: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vinculos.desvincular(r.usuarioId, id);
  }
}
