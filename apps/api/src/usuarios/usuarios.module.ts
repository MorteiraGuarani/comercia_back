import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UcheckModule } from '../ucheck/ucheck.module';
import { UcheckUsuariosService } from './ucheck-usuarios.service';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { UsuariosController } from './usuarios.controller';
import { PerfilController } from './perfil.controller';
import { UsuariosService } from './usuarios.service';
import { VinculosUcheckController } from './vinculos-ucheck.controller';
import { VinculosUcheckService } from './vinculos-ucheck.service';

@Module({
  imports: [PrismaModule, AuthModule, PlataformaModule, UcheckModule],
  controllers: [
    UsuariosController,
    PerfilController,
    AdminUsuariosController,
    VinculosUcheckController,
  ],
  providers: [UsuariosService, VinculosUcheckService, UcheckUsuariosService],
})
export class UsuariosModule {}
