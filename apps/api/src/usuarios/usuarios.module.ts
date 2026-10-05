import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { VinculosUcheckController } from './vinculos-ucheck.controller';
import { VinculosUcheckService } from './vinculos-ucheck.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    UsuariosController,
    AdminUsuariosController,
    VinculosUcheckController,
  ],
  providers: [UsuariosService, VinculosUcheckService],
})
export class UsuariosModule {}
