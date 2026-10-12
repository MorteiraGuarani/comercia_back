import { IsBoolean } from 'class-validator';
export class LocalPrincipalCampoDto {
  @IsBoolean()
  principal!: boolean;
}
