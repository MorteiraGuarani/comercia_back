import { Injectable } from '@nestjs/common';

/**
 * Pide traer ya las marcaciones guardadas en Ucheck (después de marcar, para
 * responder con la visita). La tarea la registra el módulo de integración, así
 * Campo puede pedirla sin depender de él (evita una dependencia circular).
 */
@Injectable()
export class UcheckSincronizacionService {
  private tarea?: () => Promise<void>;

  registrar(tarea: () => Promise<void>) {
    this.tarea = tarea;
  }

  ahora(): Promise<void> {
    return this.tarea ? this.tarea() : Promise.resolve();
  }
}
