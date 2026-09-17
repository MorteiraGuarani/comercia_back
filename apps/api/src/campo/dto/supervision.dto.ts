import { IsDateString, IsOptional, Matches } from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';

export class ConsultaSupervisionDto extends PaginacionDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fecha?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaInicio?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fechaFin?: string;
}

export interface ColaboradorResumenItem {
  id: number;
  nombre: string;
  iniciales: string;
  zona: string;
  telefono: string;
  asistencia: 'en_curso' | 'finalizado' | 'sin_iniciar';
  inicioJornada: string | null;
  finJornada: string | null;
  ruta: {
    total: number;
    completadas: number;
    enCurso: number;
    pct: number;
  };
  tareas: {
    total: number;
    completadas: number;
    obligPendientes: number;
    pct: number;
  };
  novedadesCount: number;
}

export interface SupervisionResumenDto {
  fecha: string;
  presentismo: {
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    totalEquipo: number;
  };
  rutas: {
    total: number;
    completadas: number;
    enCurso: number;
    pendientes: number;
    pct: number;
  };
  tareas: {
    total: number;
    completadas: number;
    obligatoriasPendientes: number;
    pct: number;
  };
  colaboradores: ColaboradorResumenItem[];
}
