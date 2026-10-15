import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampoModule } from '../campo/campo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ToleranciasController } from './tolerancias.controller';
import { ToleranciasService } from './tolerancias.service';
@Module({
  imports: [AuthModule, CampoModule, PrismaModule],
  controllers: [ToleranciasController],
  providers: [ToleranciasService],
})
export class ToleranciasModule {}
