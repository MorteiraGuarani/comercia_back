import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ConsultaOrganigramaDto {
  /** Solo superadmin: empresa a mostrar; por defecto, la propia. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  empresaId?: number;
}
