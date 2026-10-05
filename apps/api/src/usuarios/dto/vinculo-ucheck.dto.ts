import { IsInt, Max, Min } from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';

export class VinculoUcheckDto {
  @IsInt() @Min(1) @Max(MAX_INT4) ucheckUsuarioId!: number;
}
