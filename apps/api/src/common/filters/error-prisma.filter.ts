import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { codigoErrorPrisma, traducirErrorPrisma } from '../utils/error-prisma';

/**
 * Último recurso para errores de Prisma que ningún servicio atrapó: un
 * duplicado responde 409, un registro inexistente 404 y una base caída 503
 * (antes, todo eso llegaba al front como 500). El resto sigue el manejo
 * estándar de Nest.
 */
@Catch()
export class ErrorPrismaFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('ErrorPrisma');

  catch(exception: unknown, host: ArgumentsHost) {
    const traducida = traducirErrorPrisma(exception);
    if (!traducida) return super.catch(exception, host);
    const codigo = codigoErrorPrisma(exception) ?? 'sin código (conexión)';
    if (traducida.getStatus() >= 500) {
      this.logger.error(`Prisma ${codigo}: ${traducida.message}`);
    } else {
      this.logger.warn(
        `Prisma ${codigo} respondido como ${traducida.getStatus()}`,
      );
    }
    return super.catch(traducida, host);
  }
}
