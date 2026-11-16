import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../../auth/interfaces/request-con-usuario.interface';
import { ListarAuditoriaDto } from '../dto/listar-auditoria.dto';
import { AuditoriaService } from './auditoria.service';

@ApiTags('administración')
@Controller('admin/auditoria')
@UseGuards(JwtAuthGuard)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @ApiOperation({
    summary: 'Log de auditoría (superadmin y Admin TI)',
    description:
      'Altas, modificaciones, bajas, asignaciones y quitas hechas desde el backoffice (usuarios, roles, acceso por empresa, categorías, empresas, horarios, asignaciones, backups, locales y tareas de campo): quién y con qué rol, cuándo, acción, entidad, empresa y el antes/después de los campos que cambiaron. Nunca incluye contraseñas, hashes, tokens ni credenciales. Del más reciente al más antiguo, paginado (7 por defecto, máximo 50) y filtrable por fecha (desde incluido, hasta excluido), usuario (nombre), entidad y acción. Solo superadmin y roles Admin TI; el resto recibe 403.',
  })
  listar(@Req() req: RequestConUsuario, @Query() q: ListarAuditoriaDto) {
    return this.auditoria.listar(req.usuarioId, q);
  }
}
