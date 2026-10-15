import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampoModule } from '../campo/campo.module';
import { ToleranciasController } from './tolerancias.controller';
import { ToleranciasService } from './tolerancias.service';
@Module({
  imports: [AuthModule, CampoModule],
  controllers: [ToleranciasController],
  providers: [ToleranciasService],
})
export class ToleranciasModule {}
