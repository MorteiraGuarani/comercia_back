import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionDto } from '../utils/paginacion';
import { ACCIONES_AUDITORIA, ENTIDADES_AUDITORIA } from '../utils/auditoria';
import type {
  AccionAuditoria,
  EntidadAuditoria,
} from '../interfaces/auditoria.interface';

export class ListarAuditoriaDto extends PaginacionDto {
  @ApiPropertyOptional({
    description: 'Desde este instante (ISO 8601, incluido)',
    example: '2026-11-16T03:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({
    description: 'Hasta este instante (ISO 8601, excluido)',
    example: '2026-11-17T03:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({
    description: 'Nombre (o parte) de quien hizo el cambio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  usuario?: string;

  @ApiPropertyOptional({ enum: ENTIDADES_AUDITORIA })
  @IsOptional()
  @IsIn(ENTIDADES_AUDITORIA)
  entidad?: EntidadAuditoria;

  @ApiPropertyOptional({ enum: ACCIONES_AUDITORIA })
  @IsOptional()
  @IsIn(ACCIONES_AUDITORIA)
  accion?: AccionAuditoria;
}
