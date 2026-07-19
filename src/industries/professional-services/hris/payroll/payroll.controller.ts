import { BadRequestException, Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayrollService } from './payroll.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris/payroll')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class PayrollController {
  constructor(private readonly service: PayrollService) {}
  
  @RequirePermission('hris.payroll.read')
  @Get()
  getPayrollRuns(@Request() req: any) {
    return this.service.getPayrollRuns(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.payroll.write')
  @Post()
  createPayrollRun(@Request() req: any, @Body() data: { period: string }) {
    return this.service.createPayrollRun(getTenantId(req), data.period, getBranchId(req));
  }

  @RequirePermission('hris.payroll.finalize')
  @Post(':id/finalize')
  finalizePayroll(@Request() req: any, @Param('id') id: string) {
    return this.service.finalizePayroll(getTenantId(req), id);
  }

  @RequirePermission('hris.payroll.read')
  @Get(':id/payslips')
  getPayslips(@Request() req: any, @Param('id') id: string) {
    return this.service.getPayslips(getTenantId(req), id);
  }

  @RequirePermission('hris.payroll.read')
  @Get('payslips/latest')
  getLatestPayslips(@Request() req: any) {
    return this.service.getLatestPayslips(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.payroll.read')
  @Get('payslips/:itemId/pdf')
  getPayslipPdf(@Request() req: any, @Param('itemId') itemId: string) {
    return this.service.getPayslipPdf(getTenantId(req), itemId);
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
