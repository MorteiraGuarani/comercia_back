import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TOKEN_DURACION } from './auth.constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SuperadminGuard } from './superadmin.guard';
import { UcheckSsoService } from './ucheck-sso.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('app.cookieSecret'),
        signOptions: { expiresIn: TOKEN_DURACION },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SuperadminGuard, UcheckSsoService],
  exports: [AuthService, JwtAuthGuard, SuperadminGuard, JwtModule],
})
export class AuthModule {}
