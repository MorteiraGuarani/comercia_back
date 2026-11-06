import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ type: String, nullable: true, maxLength: 50 })
  ERP_Repositor!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 100 })
  ERP_CodigoAlmacen!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 100 })
  ERP_NombreAlmacen!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 100 })
  ERP_CodUsuarioSap!: string | null;
  @ApiProperty({ type: 'integer', format: 'int32', nullable: true })
  ERP_Sucursal!: number | null;
  @ApiProperty({ type: String, nullable: true, example: 'CANAL TRADICIONAL' })
  canalVentaNombre!: string | null;
  @ApiProperty({ type: String, nullable: true })
  sucursalNombre!: string | null;
  empresa!: EmpresaUsuarioRespuestaDto;
  @ApiProperty({ type: RolUsuarioRespuestaDto, nullable: true })
  rol!: RolUsuarioRespuestaDto | null;
  @ApiProperty({ type: EmpresaUsuarioRespuestaDto, nullable: true })
  superior!: EmpresaUsuarioRespuestaDto | null;
  esSuperadmin!: boolean;
  isActive!: boolean;
  /** Copia de sus programas de Ucheck (códigos), como los confirmó Ucheck. */
  @ApiProperty({ type: [String], example: ['COMERCIA', 'SEGUIMIENTO'] })
  programasUcheck!: string[];
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
