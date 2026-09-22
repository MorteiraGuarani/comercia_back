import { UnauthorizedException } from '@nestjs/common';

export function destinoSsoSeguro(destino: string, frontendUrl: string): string {
  try {
    const permitido = new URL(frontendUrl);
    const solicitado = new URL(destino);
    if (
      !['http:', 'https:'].includes(solicitado.protocol) ||
      solicitado.origin !== permitido.origin
    ) {
      throw new Error('Origen no permitido');
    }
    return solicitado.toString();
  } catch {
    throw new UnauthorizedException('El destino SSO no está autorizado');
  }
}
