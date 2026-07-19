import { Controller, Get, Post, Body, UseGuards, Query, Request, BadRequestException , UseInterceptors} from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../../common/interceptors/idempotency.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { AttendanceService } from './attendance.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

@Controller('tenant/hris/attendance')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}
  
  @RequirePermission('hris.attendance.read')
  @Get()
  getAttendance(@Request() req: any, @Query('date') date?: string) {
    return this.service.getAttendance(getTenantId(req), req.user, date, getBranchFilter(req));
  }

  @RequirePermission('hris.attendance.read')
  @Get('face-profile')
  getFaceProfile(@Request() req: any, @Query('employeeId') employeeId?: string) {
    return this.service.getFaceProfile(getTenantId(req), getTargetEmployeeId(req, employeeId), getBranchFilter(req));
  }

  @RequirePermission('hris.attendance.write')
  @Post('face-profile/enroll')
  enrollFace(@Request() req: any, @Body() data: any) {
    return this.service.enrollFace(getTenantId(req), getTargetEmployeeId(req, data.employeeId), data.photoUrl, getBranchFilter(req));
  }

  @RequirePermission('hris.attendance.write')
  @Post('liveness-challenge')
  createLivenessChallenge(@Request() req: any, @Body() data: any) {
    return this.service.createLivenessChallenge(getTenantId(req), getTargetEmployeeId(req, data.employeeId), getBranchFilter(req));
  }

  @RequirePermission('hris.attendance.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Post('clock-in')
  async clockIn(@Request() req: any, @Body() data: any) {
    try {
      return await this.service.clockIn(getTenantId(req), getTargetEmployeeId(req, data.employeeId), data, getBranchId(req));
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @RequirePermission('hris.attendance.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Post('clock-in-selfie')
  async clockInSelfie(@Request() req: any, @Body() data: any) {
    try {
      return await this.service.clockIn(getTenantId(req), getTargetEmployeeId(req, data.employeeId), data, getBranchId(req));
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @RequirePermission('hris.attendance.write')
  @UseInterceptors(IdempotencyInterceptor)
  @Post('clock-out-selfie')
  async clockOutSelfie(@Request() req: any, @Body() data: any) {
    try {
      return await this.service.clockOut(getTenantId(req), getTargetEmployeeId(req, data.employeeId), data, getBranchId(req));
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
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
    throw new BadRequestException('Tenant context missing');
  }
  return tenantId;
}

function getTargetEmployeeId(req: any, requestedEmployeeId?: string | null) {
  if (String(req.user?.tenantRole) === 'employee') {
    if (!req.user?.employeeId) {
      throw new BadRequestException('Employee profile akun ini belum terhubung.');
    }
    return req.user.employeeId;
  }
  return requestedEmployeeId ?? req.user?.employeeId;
}
