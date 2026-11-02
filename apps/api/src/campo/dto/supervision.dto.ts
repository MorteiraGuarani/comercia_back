import { IsDateString, IsOptional, Matches } from 'class-validator';
import { PaginacionDto } from '../../common/utils/paginacion';
import type {
  AsistenciaCampo,
  EstadoPresentismo,
} from '../interfaces/estado-jornada.interface';

export class ConsultaSupervisionDto extends PaginacionDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: false })
  fecha?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: false })
  fechaInicio?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: false })
  fechaFin?: string;
}

export interface ColaboradorResumenItem {
  id: number;
  /** A cargo de quién está: arma la cascada del organigrama en Jefatura. */
  superiorId: number | null;
  nombre: string;
  iniciales: string;
  zona: string;
  telefono: string;
  asistencia: AsistenciaCampo;
  estadoPresentismo: EstadoPresentismo;
  inicioJornada: string | null;
  finJornada: string | null;
  ruta: {
    total: number;
    completadas: number;
    enCurso: number;
    incompletas: number;
    ausentes: number;
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

/**
 * Mando intermedio del organigrama sin trabajo de campo (jefe, gerente, back
 * office): solo arma la cascada, no suma a los indicadores.
 */
export interface PersonaEstructuraItem {
  id: number;
  superiorId: number | null;
  nombre: string;
  iniciales: string;
  zona: string;
}

export interface SupervisionResumenDto {
  fecha: string;
  liderazgo: {
    totalTeamLeaders: number;
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    incompletos: number;
    ausentes: number;
    visitasCompletadas: number;
    visitasTotales: number;
    pctVisitas: number;
  };
  presentismo: {
    enRuta: number;
    finalizados: number;
    sinIniciar: number;
    incompletos: number;
    ausentes: number;
    estados: Record<EstadoPresentismo, number>;
    totalEquipo: number;
  };
  rutas: {
    total: number;
    completadas: number;
    enCurso: number;
    incompletas: number;
    ausentes: number;
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
  /** Solo en Jefatura: los mandos intermedios de la cadena. */
  estructura?: PersonaEstructuraItem[];
}
