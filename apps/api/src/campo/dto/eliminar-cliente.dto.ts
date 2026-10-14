import { IsBoolean } from 'class-validator';

export class EliminarClienteCampoDto {
  @IsBoolean()
  eliminarLocales = false;
}
