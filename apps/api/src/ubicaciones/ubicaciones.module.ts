import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampoModule } from '../campo/campo.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesService } from './ubicaciones.service';

@Module({
  imports: [AuthModule, PrismaModule, CampoModule],
  controllers: [UbicacionesController],
  providers: [UbicacionesService],
})
export class UbicacionesModule {}
