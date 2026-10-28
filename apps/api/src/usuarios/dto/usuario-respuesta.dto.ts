import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_INT4, MIN_INT4 } from '../../common/utils/numeros';
import type { UsuarioAdminDto } from '../interfaces/usuario-admin.interface';

export class EmpresaUsuarioRespuestaDto {
  id!: number;
  nombre!: string;
}

export class RolUsuarioRespuestaDto {
  id!: number;
  descripcion!: string;
}

/** Respuesta del ABM: campos explícitos, sin credenciales ni datos de sesión. */
export class UsuarioAdminRespuestaDto implements UsuarioAdminDto {
  id!: number;
  nombre!: string;
  apellido!: string;
  correo!: string;
  nombreLogin!: string;
  @ApiProperty({ type: String, nullable: true })
  ruc!: string | null;
  celular!: string;
  @ApiProperty({ type: String, nullable: true })
  legajo!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 50 })
  ERP_CanalVenta!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 8 })
  ERP_Almacen!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 30 })
  ERP_Supervisor!: string | null;
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    nullable: true,
    minimum: MIN_INT4,
    maximum: MAX_INT4,
  })
  ERP_Vendedor!: number | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 50 })
  ERP_Repositor!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 50 })
  ERP_Impulsador!: string | null;
  empresa!: EmpresaUsuarioRespuestaDto;
  @ApiProperty({ type: RolUsuarioRespuestaDto, nullable: true })
  rol!: RolUsuarioRespuestaDto | null;
  @ApiProperty({ type: EmpresaUsuarioRespuestaDto, nullable: true })
  superior!: EmpresaUsuarioRespuestaDto | null;
  esSuperadmin!: boolean;
  isActive!: boolean;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class PaginaUsuariosRespuestaDto {
  items!: UsuarioAdminRespuestaDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class ErrorLoteUsuarioRespuestaDto {
  indice!: number;
  @ApiPropertyOptional()
  id?: number;
  @ApiPropertyOptional()
  usuario?: string;
  error!: string;
}

export class LoteUsuariosRespuestaDto {
  total!: number;
  exitosos!: number;
  fallidos!: number;
  resultados!: UsuarioAdminRespuestaDto[];
  errores!: ErrorLoteUsuarioRespuestaDto[];
}
