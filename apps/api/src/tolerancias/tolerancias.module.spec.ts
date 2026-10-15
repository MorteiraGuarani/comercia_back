import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ToleranciasModule } from './tolerancias.module';
import { ToleranciasService } from './tolerancias.service';

jest.mock('uuid', () => ({ v4: () => '00000000-0000-4000-8000-000000000000' }));

it('resuelve las dependencias reales del módulo de tolerancias sin conectar a la base', async () => {
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        skipProcessEnv: true,
        load: [() => ({ app: { cookieSecret: 'solo-prueba-de-inyeccion' } })],
      }),
      ToleranciasModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  try {
    expect(modulo.get(ToleranciasService)).toBeInstanceOf(ToleranciasService);
  } finally {
    await modulo.close();
  }
});
