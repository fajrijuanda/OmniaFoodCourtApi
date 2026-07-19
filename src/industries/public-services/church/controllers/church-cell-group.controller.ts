import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChurchCellGroupService } from "../services/church-cell-group.service";

interface AuthRequest { user: { tenantId: string; activeBranchId?: string | null; branchId?: string | null; branchScope?: "single" | "all" } }

function getBranchId(req: AuthRequest) {
  return req.user.branchScope === "all" ? undefined : req.user.activeBranchId ?? req.user.branchId ?? undefined;
}

@Controller("tenant/church/church-cell-groups")
@UseGuards(AuthGuard("jwt"))
export class ChurchCellGroupController {
  constructor(private readonly service: ChurchCellGroupService) {}

  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.service.findAll(req.user.tenantId, getBranchId(req));
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

  @Post(":id/members")
  addMember(@Param("id") id: string, @Request() req: AuthRequest, @Body("memberId") memberId: string) {
    return this.service.addMember(id, req.user.tenantId, memberId, getBranchId(req));
  }

  @Delete(":id/members/:memberId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(@Param("id") id: string, @Param("memberId") memberId: string, @Request() req: AuthRequest) {
    return this.service.removeMember(id, req.user.tenantId, memberId, getBranchId(req));
  }
}
