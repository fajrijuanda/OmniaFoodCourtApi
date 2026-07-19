import { Controller, Get, Post, Body, UseGuards, Query, Request, Delete, Param, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmployeesService } from './employees.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris/employees')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}
  
  @RequirePermission('hris.employee.read')
  @Get()
  getEmployees(@Request() req: any, @Query('search') search?: string, @Query('status') status?: string) {
    return this.service.getEmployees(getTenantId(req), req.user, search, getBranchFilter(req), status);
  }

  @RequirePermission('hris.employee.write')
  @Post()
  createEmployee(@Request() req: any, @Body() data: any) {
    return this.service.createEmployee(getTenantId(req), req.user, data, getBranchId(req));
  }

  @RequirePermission('hris.employee.write')
  @Delete(':id')
  archiveEmployee(@Request() req: any, @Param('id') id: string) {
    return this.service.archiveEmployee(getTenantId(req), req.user, id, getBranchFilter(req));
  }

  @RequirePermission('hris.employee.write')
  @Patch(':id/restore')
  restoreEmployee(@Request() req: any, @Param('id') id: string) {
    return this.service.restoreEmployee(getTenantId(req), req.user, id, getBranchFilter(req));
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
  if (!tenantId) {
    throw new Error('Tenant context missing');
  }
  return tenantId;
}
