import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ToleranciaHorarioDto } from './dto/tolerancia-horario.dto';
import {
  heredarTolerancias,
  combinarTolerancias,
  toleranciasCoherentes,
  valoresTolerancia,
} from './utils/tolerancia-horario';
import type { AlcanceTolerancia } from './interfaces/tolerancia-horario.interface';
import { CampoAccesoService } from '../campo/campo-acceso.service';
import { obtenerColaboradoresGestionados } from '../campo/utils/autorizacion';

@Injectable()
export class ToleranciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acceso: CampoAccesoService,
  ) {}
  private async autorizar(actor: number, alcance: string, id: number) {
    if (
      !['global', 'empresa', 'horario', 'usuario'].includes(alcance) ||
      !Number.isSafeInteger(id) ||
      id > 2147483647 ||
      id < 0 ||
      (alcance === 'global' ? id !== 0 : id === 0)
    )
      throw new BadRequestException(
        'Ámbito o identificador de tolerancias inválido',
      );
    const admin = await this.prisma.usuario.findFirst({
      where: { id: actor, isActive: true },
      select: { esSuperadmin: true },
    });
    if (!admin) throw new ForbiddenException('Sesión no disponible');
    if (alcance === 'global') {
      if (!admin.esSuperadmin)
        throw new ForbiddenException('Requiere superadministrador');
      return null;
    }
    if (alcance === 'empresa') {
      if (!admin.esSuperadmin)
        throw new ForbiddenException(
          'Requiere superadministrador para configurar toda la empresa',
        );
      if (
        !(await this.prisma.empresa.findUnique({
          where: { id },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Empresa no disponible');
      return id;
    }
    if (admin.esSuperadmin) {
      const recurso =
        alcance === 'usuario'
          ? await this.prisma.usuario.findUnique({
              where: { id },
              select: { empresaId: true },
            })
          : await this.prisma.horarioCampo.findUnique({
              where: { id },
              select: { empresaId: true },
            });
      if (!recurso) throw new NotFoundException('Recurso no disponible');
      return recurso.empresaId;
    }
    const u = await this.acceso.gestionar(actor, 'locales');
    if (alcance === 'usuario') {
      const permitidos = await obtenerColaboradoresGestionados(this.prisma, u);
      if (!permitidos.includes(id))
        throw new NotFoundException('Usuario no disponible en tu equipo');
      if (
        !(await this.prisma.usuario.findFirst({
          where: { id, empresaId: u.empresaId, isActive: true },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Usuario no disponible');
    } else if (
      !(await this.prisma.horarioCampo.findFirst({
        where: {
          id,
          activo: true,
          equipoCampoId: u.equipoCampo?.id,
          empresaId: u.empresaId,
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Horario no disponible');
    return u.empresaId;
  }
  async consultar(
    actor: number,
    alcance: string,
    id: number,
    empresaSolicitada?: number,
  ) {
    const empresaId = await this.autorizar(actor, alcance, id);
    if (
      empresaSolicitada !== undefined &&
      empresaId !== null &&
      empresaSolicitada !== empresaId
    )
      throw new ForbiddenException(
        'El recurso no pertenece a la empresa seleccionada',
      );
    const clave = alcance + ':' + id;
    const clavesBase =
      alcance === 'global'
        ? []
        : [
            'global:0',
            ...(alcance === 'empresa' ? [] : ['empresa:' + empresaId]),
          ];
    const filas = await this.prisma.configuracionTolerancia.findMany({
      where: {
        clave: { in: [...clavesBase, clave] },
        OR: [{ empresaId }, { empresaId: null }],
      },
      select: { clave: true, valores: true },
      take: 3,
    });
    const mapa = new Map(filas.map((f) => [f.clave, f.valores]));
    const heredados = heredarTolerancias(...clavesBase.map((c) => mapa.get(c)));
    const valores = valoresTolerancia(mapa.get(clave));
    return {
      alcance: alcance as AlcanceTolerancia,
      id,
      valores,
      heredados,
      efectivos: heredarTolerancias(heredados, valores),
    };
  }
  async guardar(
    actor: number,
    alcance: string,
    id: number,
    dto: ToleranciaHorarioDto,
    empresaSolicitada?: number,
  ) {
    const empresaId = await this.autorizar(actor, alcance, id);
    const actual = await this.consultar(actor, alcance, id, empresaSolicitada);
    // PUT reemplaza los valores propios; null y campos omitidos vuelven a heredar.
    const valores = valoresTolerancia(dto);
    if (!toleranciasCoherentes(combinarTolerancias(actual.heredados, valores)))
      throw new BadRequestException(
        'El límite amarillo no puede ser menor que su tolerancia verde',
      );
    await this.prisma.configuracionTolerancia.upsert({
      where: { clave: alcance + ':' + id },
      create: {
        clave: alcance + ':' + id,
        empresaId,
        valores: valores,
      },
      update: { empresaId, valores },
      select: { clave: true },
    });
    return this.consultar(actor, alcance, id, empresaSolicitada);
  }
}
