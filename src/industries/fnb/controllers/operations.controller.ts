import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { FnbOperationsService } from '../services/fnb-operations.service';

function getTenantId(req: Request) {
  const user = req.user as any;
  const tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.id;
  if (!tenantId) throw new UnauthorizedException('Tenant ID not found in context.');
  return tenantId;
}

function getBranchId(req: Request) {
  const user = req.user as any;
  return user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined;
}

@Controller('fnb/operations')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class FnbOperationsController {
  constructor(private readonly operationsService: FnbOperationsService) {}

  @RequirePermission('fnb.operations.read')
  @Get('snapshot')
  getSnapshot(@Req() req: Request) {
    return this.operationsService.getSnapshot(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('promo-rules')
  getPromoRules(@Req() req: Request) {
    return this.operationsService.getPromoRules(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('promo-rules')
  createPromoRule(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createPromoRule(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('pre-orders')
  getPreOrders(@Req() req: Request) {
    return this.operationsService.getPreOrders(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('pre-orders')
  createPreOrder(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createPreOrder(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Patch('pre-orders/:id/status')
  updatePreOrderStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string }) {
    return this.operationsService.updatePreOrderStatus(getTenantId(req), id, body.status);
  }

  @RequirePermission('fnb.operations.read')
  @Get('wholesale-customers')
  getWholesaleCustomers(@Req() req: Request) {
    return this.operationsService.getWholesaleCustomers(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('wholesale-customers')
  createWholesaleCustomer(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createWholesaleCustomer(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('wholesale-orders')
  getWholesaleOrders(@Req() req: Request) {
    return this.operationsService.getWholesaleOrders(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('wholesale-orders')
  createWholesaleOrder(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createWholesaleOrder(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Patch('wholesale-orders/:id/status')
  updateWholesaleOrderStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string }) {
    return this.operationsService.updateWholesaleOrderStatus(getTenantId(req), id, body.status);
  }

  @RequirePermission('fnb.operations.read')
  @Get('delivery-integrations')
  getDeliveryIntegrations(@Req() req: Request) {
    return this.operationsService.getDeliveryIntegrations(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('delivery-integrations')
  createDeliveryIntegration(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createDeliveryIntegration(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('delivery-statuses')
  getDeliveryStatuses(@Req() req: Request) {
    return this.operationsService.getDeliveryStatuses(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('delivery-statuses/generate')
  generateDeliveryStatuses(@Req() req: Request) {
    return this.operationsService.generateDeliveryStatuses(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('food-court-tenants')
  getFoodCourtTenants(@Req() req: Request) {
    return this.operationsService.getFoodCourtTenants(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('food-court-tenants')
  createFoodCourtTenant(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.operationsService.createFoodCourtTenant(getTenantId(req), body, getBranchId(req));
  }

  @RequirePermission('fnb.operations.read')
  @Get('tenant-settlements')
  getTenantSettlements(@Req() req: Request) {
    return this.operationsService.getTenantSettlements(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Post('tenant-settlements/generate')
  generateTenantSettlements(@Req() req: Request) {
    return this.operationsService.generateTenantSettlements(getTenantId(req), getBranchId(req));
  }

  @RequirePermission('fnb.operations.write')
  @Patch('tenant-settlements/:id/pay')
  markSettlementPaid(@Req() req: Request, @Param('id') id: string) {
    return this.operationsService.markSettlementPaid(getTenantId(req), id);
  }
}
