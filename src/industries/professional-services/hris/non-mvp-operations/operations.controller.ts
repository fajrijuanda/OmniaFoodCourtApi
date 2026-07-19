import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HrisOperationsService } from './operations.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class HrisOperationsController {
  constructor(private readonly service: HrisOperationsService) {}

  @RequirePermission('hris.dashboard.read')
  @Get('dashboard/summary')
  getDashboard(@Request() req: any) {
    return this.service.getDashboard(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.dashboard.read')
  @Get('dashboard/export')
  exportDashboard(@Request() req: any, @Query('format') format?: 'pdf' | 'excel') {
    return this.service.exportDashboard(getTenantId(req), format ?? 'excel', getBranchFilter(req));
  }

  @RequirePermission('hris.reimbursement.read')
  @Get('reimbursement')
  listReimbursements(@Request() req: any) {
    return this.service.listReimbursements(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.reimbursement.write')
  @Post('reimbursement')
  createReimbursement(@Request() req: any, @Body() data: any) {
    return this.service.createReimbursement(getTenantId(req), data, getBranchId(req));
  }

  @RequirePermission('hris.reimbursement.manage')
  @Patch('reimbursement/:id/status')
  updateReimbursementStatus(@Request() req: any, @Param('id') id: string, @Body() data: { status: string }) {
    return this.service.updateReimbursementStatus(getTenantId(req), id, data.status);
  }

  @RequirePermission('hris.fieldreport.read')
  @Get('field-report')
  listFieldReports(@Request() req: any) {
    return this.service.listFieldReports(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.fieldreport.write')
  @Post('field-report')
  createFieldReport(@Request() req: any, @Body() data: any) {
    return this.service.createFieldReport(getTenantId(req), data, getBranchId(req));
  }

  @RequirePermission('hris.performance.read')
  @Get('performance')
  listKpis(@Request() req: any) {
    return this.service.listKpis(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.performance.write')
  @Post('performance')
  createKpi(@Request() req: any, @Body() data: any) {
    return this.service.createKpi(getTenantId(req), data, getBranchId(req));
  }

  @RequirePermission('hris.recruitment.read')
  @Get('recruitment/jobs')
  listJobs(@Request() req: any) {
    return this.service.listJobs(getTenantId(req), getBranchFilter(req));
  }

  @RequirePermission('hris.recruitment.write')
  @Post('recruitment/jobs')
  createJob(@Request() req: any, @Body() data: any) {
    return this.service.createJob(getTenantId(req), data, getBranchId(req));
  }

  @RequirePermission('hris.recruitment.write')
  @Post('recruitment/jobs/:id/applicants')
  createApplicant(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.service.createApplicant(getTenantId(req), id, data, getBranchId(req));
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
