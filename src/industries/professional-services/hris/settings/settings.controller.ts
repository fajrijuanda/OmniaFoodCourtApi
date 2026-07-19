import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { UpdateHrisSettingsDto } from '../dto/hris-settings.dto';
import { HrisSettingsService } from './settings.service';
import { PermissionGuard } from '../../../../common/guards/permission.guard';
import { RequirePermission } from '../../../../common/decorators/require-permission.decorator';

function getBranchId(req: Request, requested?: string) {
  const user = req.user as any;
  if (requested === 'default') return null;
  if (requested) return requested;
  return user?.branchScope === 'all' ? null : user?.activeBranchId ?? user?.branchId ?? null;
}

@Controller('tenant/hris/settings')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class HrisSettingsController {
  constructor(private readonly service: HrisSettingsService) {}

  @RequirePermission('hris.settings.read')
  @Get()
  getSettings(@Req() req: Request, @Query('branchId') branchId?: string) {
    const user = req.user as any;
    return this.service.getSettings(user.tenantId, getBranchId(req, branchId));
  }

  @RequirePermission('hris.settings.write')
  @Patch()
  updateSettings(@Req() req: Request, @Body() body: UpdateHrisSettingsDto, @Query('branchId') branchId?: string) {
    const user = req.user as any;
    return this.service.updateSettings(user.tenantId, body, getBranchId(req, branchId));
  }
}
