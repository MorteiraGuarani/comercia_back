import type { ConsultaSociosDto } from '../dto/consulta-socios.dto';

export interface ConsultaDireccion extends ConsultaSociosDto {
  direccion?: string;
}
