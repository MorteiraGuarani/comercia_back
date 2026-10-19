import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestConUsuario } from '../auth/interfaces/request-con-usuario.interface';
import { LIMITE_ITEMS_INVENTARIO } from './inventario.constants';
import { InventarioService } from './inventario.service';

@ApiTags('Inventario del impulsador')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sesión requerida' })
@ApiForbiddenResponse({ description: 'Sin acceso a Mi jornada · Inventario' })
@Controller('campo/inventario')
@UseGuards(JwtAuthGuard)
export class InventarioController {
  constructor(private readonly servicio: InventarioService) {}

  // Excepción a la paginación obligatoria, por pedido explícito del usuario:
  // el navegador guarda el catálogo completo para usarlo sin conexión.
  @Get('items')
  @ApiOperation({
    summary: 'Catálogo completo de artículos de la empresa',
    description: `Todas las filas de tbl_itm1 de la empresa del usuario: un artículo aparece una vez por cada lista de precios. Ordenadas por código y lista. Sin paginar, con un máximo de ${LIMITE_ITEMS_INVENTARIO} filas. id y price viajan como texto.`,
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['items', 'total'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'id',
              'itemcode',
              'itemname',
              'pricelist',
              'pricelistname',
              'price',
            ],
            properties: {
              id: { type: 'string', example: '1' },
              itemcode: { type: 'string', example: 'A-1001' },
              itemname: { type: 'string', example: 'Artículo de ejemplo' },
              pricelist: { type: 'integer', example: 1 },
              pricelistname: {
                type: 'string',
                nullable: true,
                example: 'Lista mayorista',
              },
              price: {
                type: 'string',
                nullable: true,
                example: '25000.000000',
              },
            },
          },
        },
        total: { type: 'integer', example: 1 },
      },
    },
  })
  @ApiPayloadTooLargeResponse({
    description: `El catálogo supera ${LIMITE_ITEMS_INVENTARIO} artículos; no se entrega truncado`,
  })
  listarItems(@Req() r: RequestConUsuario) {
    return this.servicio.listarItems(r.usuarioId);
  }
}
