import { Module } from '@nestjs/common';
import { UcheckClienteService } from './ucheck-cliente.service';
import { UcheckSincronizacionService } from './ucheck-sincronizacion.service';

/** Acceso a Ucheck, fuente de las marcaciones y los pings del equipo. */
@Module({
  providers: [UcheckClienteService, UcheckSincronizacionService],
  exports: [UcheckClienteService, UcheckSincronizacionService],
})
export class UcheckModule {}
