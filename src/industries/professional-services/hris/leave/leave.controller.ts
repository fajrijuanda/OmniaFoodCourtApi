import { BadRequestException, Controller, Get, Post, Patch, Param, Body, UseGuards, Request , UseInterceptors} from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../../common/interceptors/idempotency.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { LeaveService } from './leave.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris/leave')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}
  
  @RequirePermission('hris.leave.read')
  @Get()
  getLeaveRequests(@Request() req: any) {
    return this.service.getLeaveRequests(getTenantId(req), req.user, getBranchFilter(req));
  }

  @RequirePermission('hris.leave.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Post()
  createLeaveRequest(@Request() req: any, @Body() data: any) {
    return this.service.createLeaveRequest(getTenantId(req), req.user, data, getBranchId(req));
  }

  @RequirePermission('hris.leave.manage')
  @Patch(':id/status')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() data: { status: string }) {
    return this.service.updateLeaveStatus(getTenantId(req), req.user, id, data.status, getBranchFilter(req));
  }
}

function getBranchId(req: any) {
  return req.user?.activeBranchId ?? req.user?.branchId ?? null;
}

function getBranchFilter(req: any) {
  return req.user?.branchScope === "all" ? undefined : getBranchId(req);
}

function getTenantId(req: any) {
  const tenantId = req.user?.tenantId ?? req.user?.tenantUsers?.[0]?.tenantId ?? req.user?.tenantUsers?.[0]?.tenant?.id;
  if (!tenantId) throw new BadRequestException('Tenant context missing');
  return tenantId;
}
