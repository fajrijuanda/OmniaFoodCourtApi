import * as crypto from 'crypto';
import { Controller, Get, Post, Body, Param, Query, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { PosOrderService } from '../services/pos-order.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('fnb/public')
export class PosPublicController {
  constructor(private readonly orderService: PosOrderService) {}

  @Get('catalog/:tenantId')
  async getCatalog(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('tenantId') tenantId: string
  ) {
    const data = await this.orderService.getCatalog(tenantId, undefined, { includeHidden: false, includeArchived: false });
    const etag = `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
    res.setHeader('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).send();
      return;
    }
    return data;
  }

  @Get('tables/:tenantId')
  async getTables(
    @Param('tenantId') tenantId: string,
    @Query('reservationTime') reservationTime?: string,
    @Query('pax') pax?: string,
  ) {
    const paxNum = pax ? parseInt(pax, 10) : undefined;
    return this.orderService.getTables(tenantId, reservationTime, paxNum);
  }

  @Post('orders/:tenantId')
  async placeOrder(@Param('tenantId') tenantId: string, @Body() data: CreateOrderDto) {
    return this.orderService.createOrder(tenantId, data);
  }

  @Get('orders/:tenantId/history')
  async getOrderHistory(
    @Param('tenantId') tenantId: string,
    @Query('ids') ids: string, // comma separated order IDs
  ) {
    if (!ids) return [];
    const orderIds = ids.split(',').filter(Boolean);
    return this.orderService.getOrderHistory(tenantId, orderIds);
  }

  @Get('orders/:tenantId/:orderId')
  async getReceipt(
    @Param('tenantId') tenantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.orderService.getReceipt(tenantId, orderId);
  }
}
