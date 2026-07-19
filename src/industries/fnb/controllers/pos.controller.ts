import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Body, Controller, Sse, MessageEvent, Delete, Get, Param, Patch, Post, Query, Req, UseGuards , UseInterceptors, Res } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { PosOrderService } from '../services/pos-order.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateSettingsDto, CreateTableDto, UpdateTableDto, CreateReservationDto, UpdateReservationStatusDto, CreateIngredientDto, UpdateIngredientDto, MarkOrderAsPaidDto, OpenShiftDto, CloseShiftDto, CreateStockAdjustmentDto, UpdateKitchenOrderStatusDto, CreateCategoryDto, UpdateCategoryDto, CreatePromoBannerDto, UpdatePromoBannerDto, CreateProductDto, UpdateProductDto, UpdateFollowUpStatusDto } from '../dto/pos-dtos';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';



function getBranchId(req: Request) {
  const user = req.user as any;
  return user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined;
}

@Controller('fnb/pos')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class PosController {
  @RequirePermission('fnb.pos.read')
  @Sse('kds/events')
  kdsEvents(@Req() req: Request, @Query('branchId') branchId?: string): Observable<MessageEvent> {
    const user = req.user as any;
    const tenantId = user.tenantId;
    const filterBranchId = branchId === 'default' ? null : branchId ?? getBranchId(req) ?? null;
    
    return this.orderService.orderEvents$.pipe(
      filter(event => event.tenantId === tenantId && (!filterBranchId || event.branchId === filterBranchId)),
      map(event => ({
        data: event.data,
        type: event.type
      }))
    );
  }

  constructor(private readonly orderService: PosOrderService) {}

  @RequirePermission('fnb.pos.read')
  @Get('catalog')
  async getCatalog(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('subIndustry') subIndustry?: string,
    @Query('scope') scope?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    const data = await this.orderService.getCatalog(tenantId, subIndustry, {
      includeHidden: scope === 'management',
      includeArchived: includeArchived === 'true',
    }, getBranchId(req));

    const etag = `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
    res.setHeader('ETag', etag);

    if (req.headers['if-none-match'] === etag) {
      res.status(304).send();
      return;
    }
    return data;
  }

  @RequirePermission('fnb.pos.read')
  @Get('settings')
  async getSettings(@Req() req: Request, @Query('branchId') branchId?: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getFnbSettings(tenantId, branchId === 'default' ? null : branchId ?? getBranchId(req) ?? null);
  }

  @RequirePermission('fnb.pos.write')
  @Patch('settings')
  async updateSettings(@Req() req: Request, @Body() body: UpdateSettingsDto, @Query('branchId') branchId?: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);
    return this.orderService.updateFnbSettings(tenantId, body, branchId === 'default' ? null : branchId ?? getBranchId(req) ?? null);
  }

  @RequirePermission('fnb.pos.read')
  @Get('tables')
  async getTables(@Req() req: Request, @Query('reservationTime') reservationTime?: string, @Query('pax') pax?: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getTables(tenantId, reservationTime, pax ? Number(pax) : undefined, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('tables')
  async createTable(@Req() req: Request, @Body() body: CreateTableDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createTable(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('tables/:id')
  async updateTable(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateTableDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateTable(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('reservations')
  async getReservations(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getReservations(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('reservations')
  async createReservation(@Req() req: Request, @Body() body: CreateReservationDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createReservation(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('reservations/:id/status')
  async updateReservationStatus(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateReservationStatusDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateReservationStatus(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('ingredients')
  async getIngredients(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getIngredients(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('ingredients')
  async createIngredient(@Req() req: Request, @Body() body: CreateIngredientDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createIngredient(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('ingredients/:id')
  async updateIngredient(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateIngredientDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateIngredient(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Delete('ingredients/:id')
  async deleteIngredient(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.deleteIngredient(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Post('orders')
  async createOrder(@Req() req: Request, @Body() body: CreateOrderDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createOrder(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('orders')
  async getOrders(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getOrders(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Patch('orders/:id/pay')
  async markOrderAsPaid(@Req() req: Request, @Param('id') id: string, @Body() body: { cashReceived?: number }) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.markOrderAsPaid(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('shifts')
  async getShifts(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getShifts(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('shifts')
  async openShift(@Req() req: Request, @Body() body: OpenShiftDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.openShift(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('shifts/:id/close')
  async closeShift(@Req() req: Request, @Param('id') id: string, @Body() body: CloseShiftDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.closeShift(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('stock-logs')
  async getStockLogs(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getStockLogs(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('stock-adjustments')
  async createStockAdjustment(@Req() req: Request, @Body() body: CreateStockAdjustmentDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createStockAdjustment(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.read')
  @Get('kds/orders')
  async getKitchenOrders(@Req() req: Request) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.getKitchenOrders(tenantId, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('kds/orders/:id/status')
  async updateKitchenOrderStatus(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateKitchenOrderStatusDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateKitchenOrderStatus(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('categories')
  async createCategory(@Req() req: Request, @Body() body: CreateCategoryDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createCategory(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('categories/:id')
  async updateCategory(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateCategoryDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateCategory(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Delete('categories/:id')
  async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.deleteCategory(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('promo-banners')
  async createPromoBanner(@Req() req: Request, @Body() body: CreatePromoBannerDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createPromoBanner(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('promo-banners/:id')
  async updatePromoBanner(@Req() req: Request, @Param('id') id: string, @Body() body: UpdatePromoBannerDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updatePromoBanner(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Delete('promo-banners/:id')
  async deletePromoBanner(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.deletePromoBanner(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Post('products')
  async createProduct(@Req() req: Request, @Body() body: CreateProductDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.createProduct(tenantId, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('products/:id')
  async updateProduct(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateProductDto) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateProduct(tenantId, id, body, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Delete('products/:id')
  async deleteProduct(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.deleteProduct(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('products/:id/restore')
  async restoreProduct(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.restoreProduct(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('orders/:id/cancel')
  async cancelOrder(@Req() req: Request, @Param('id') id: string) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.cancelOrder(tenantId, id, getBranchId(req));
  }

  @RequirePermission('fnb.pos.write')
  @Patch('orders/:id/follow-up')
  async updateFollowUpStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string }) {
    const tenantId = await this.orderService.resolveTenantId(req.user);

    return this.orderService.updateFollowUpStatus(tenantId, id, body.status, getBranchId(req));
  }
}

