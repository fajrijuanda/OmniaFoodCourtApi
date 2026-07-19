import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChurchAssetService } from "../services/church-asset.service";

interface AuthRequest { user: { tenantId: string; activeBranchId?: string | null; branchId?: string | null; branchScope?: "single" | "all" } }

function getBranchId(req: AuthRequest) {
  return req.user.branchScope === "all" ? undefined : req.user.activeBranchId ?? req.user.branchId ?? undefined;
}

@Controller("tenant/church/church-assets")
@UseGuards(AuthGuard("jwt"))
export class ChurchAssetController {
  constructor(private readonly service: ChurchAssetService) {}

  @Get()
  findAll(@Request() req: AuthRequest, @Query("status") status?: string) {
    return this.service.findAll(req.user.tenantId, status, getBranchId(req));
  }

  @Get("stats")
  stats(@Request() req: AuthRequest) {
    return this.service.stats(req.user.tenantId, getBranchId(req));
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.service.findOne(id, req.user.tenantId, getBranchId(req));
  }

  @Post()
  create(@Request() req: AuthRequest, @Body() body: any) {
    return this.service.create(req.user.tenantId, body, getBranchId(req));
  }

  @Put(":id")
  update(@Param("id") id: string, @Request() req: AuthRequest, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body, getBranchId(req));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string, @Request() req: AuthRequest) {
    return this.service.remove(id, req.user.tenantId, getBranchId(req));
  }
}
