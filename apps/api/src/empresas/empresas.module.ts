import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminEmpresasController } from './admin-empresas.controller';
import { AdminEmpresasService } from './admin-empresas.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminEmpresasController],
  providers: [AdminEmpresasService],
})
export class EmpresasModule {}
