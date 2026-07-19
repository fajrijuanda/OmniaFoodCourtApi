import { Body, Controller, Get, Patch, Query, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChurchSettingsService } from "../services/church-settings.service";

interface AuthRequest {
  user: { tenantId: string; activeBranchId?: string | null; branchId?: string | null; branchScope?: "single" | "all" };
}

function getBranchId(req: AuthRequest, requested?: string) {
  if (requested === "default") return null;
  if (requested) return requested;
  return req.user.branchScope === "all" ? null : req.user.activeBranchId ?? req.user.branchId ?? null;
}

@Controller("tenant/church/settings")
@UseGuards(AuthGuard("jwt"))
export class ChurchSettingsController {
  constructor(private readonly service: ChurchSettingsService) {}

  @Get()
  getSettings(@Request() req: AuthRequest, @Query("branchId") branchId?: string) {
    return this.service.getSettings(req.user.tenantId, getBranchId(req, branchId));
  }

  @Patch()
  updateSettings(@Request() req: AuthRequest, @Body() body: Record<string, unknown>, @Query("branchId") branchId?: string) {
    return this.service.updateSettings(req.user.tenantId, body, getBranchId(req, branchId));
  }
}
