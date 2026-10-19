import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { MAX_INT4 } from '../../common/utils/numeros';
import { ConsultaCampoDto } from './campo.dto';

/** Tareas de varios locales de la ruta en un solo pedido (?asignaciones=1,2,3). */
export class ConsultaTareasDiaDto extends ConsultaCampoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .filter(Boolean)
          .map((id) => Number(id))
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  asignaciones!: number[];
}
