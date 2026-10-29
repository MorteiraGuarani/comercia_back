import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperadminGuard } from '../auth/superadmin.guard';
import { AdminTiGuard } from '../auth/admin-ti.guard';
import { PaginacionDto } from '../common/utils/paginacion';
import {
  ActualizarEmpresaAdminDto,
  CrearEmpresaAdminDto,
} from './dto/empresa-admin.dto';
import { AdminEmpresasService } from './admin-empresas.service';

@ApiTags('administración')
@Controller('admin/empresas')
@UseGuards(JwtAuthGuard)
export class AdminEmpresasController {
  constructor(private readonly empresas: AdminEmpresasService) {}

  @Get()
  @UseGuards(AdminTiGuard)
  listar(@Query() query: PaginacionDto) {
    return this.empresas.listar(query);
  }

  @Post()
  @UseGuards(SuperadminGuard)
  crear(@Body() dto: CrearEmpresaAdminDto) {
    return this.empresas.crear(dto);
  }

  @Patch(':id')
  @UseGuards(SuperadminGuard)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEmpresaAdminDto,
  ) {
    return this.empresas.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(SuperadminGuard)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.empresas.eliminar(id);
  }
}
