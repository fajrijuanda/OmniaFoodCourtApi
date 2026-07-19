import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequireTier } from '../../../../auth/tier.decorator';
import { TierGuard } from '../../../../auth/tier.guard';
import { LoansService } from './loans.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris/loans')
@UseGuards(AuthGuard('jwt'), TierGuard, PermissionGuard)
@RequireTier('hris', 'growth')
export class LoansController {
  constructor(private readonly service: LoansService) {}

  @RequirePermission('hris.loan.read')
  @Get()
  listLoans(@Request() req: any) {
    return this.service.listLoans(getTenantId(req), req.user, getBranchFilter(req));
  }

  @RequirePermission('hris.loan.write')
  @Post()
  createLoan(@Request() req: any, @Body() data: any) {
    return this.service.createLoan(getTenantId(req), req.user, data, getBranchId(req));
  }

  @RequirePermission('hris.loan.manage')
  @Patch(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: 'Approved' | 'Rejected' | 'Paid'; notes?: string }) {
    return this.service.updateStatus(getTenantId(req), req.user, id, body.status, body.notes);
  }
}

function getBranchId(req: any) {
  return req.user?.activeBranchId ?? req.user?.branchId ?? null;
}

function getBranchFilter(req: any) {
  return req.user?.branchScope === 'all' ? undefined : getBranchId(req);
}

function getTenantId(req: any) {
  const tenantId = req.user?.tenantId ?? req.user?.tenantUsers?.[0]?.tenantId ?? req.user?.tenantUsers?.[0]?.tenant?.id;
  if (!tenantId) throw new BadRequestException('Tenant context missing');
  return tenantId;
}
