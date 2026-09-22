import { IsString, Length } from 'class-validator';

export class CallbackUcheckSsoDto {
  @IsString()
  @Length(43, 128)
  code!: string;
}
