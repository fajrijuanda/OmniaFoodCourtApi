import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChurchEventService } from "../services/church-event.service";

interface AuthRequest { user: { tenantId: string; activeBranchId?: string | null; branchId?: string | null; branchScope?: "single" | "all" } }

function getBranchId(req: AuthRequest) {
  return req.user.branchScope === "all" ? undefined : req.user.activeBranchId ?? req.user.branchId ?? undefined;
}

@Controller("tenant/church/church-events")
@UseGuards(AuthGuard("jwt"))
export class ChurchEventController {
  constructor(private readonly service: ChurchEventService) {}

  @Get()
  findAll(@Request() req: AuthRequest, @Query("eventType") eventType?: string) {
    return this.service.findAll(req.user.tenantId, eventType, getBranchId(req));
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

  @Post(":id/volunteers")
  addVolunteer(
    @Param("id") eventId: string,
    @Request() req: AuthRequest,
    @Body() body: { memberId: string; role: string },
  ) {
    return this.service.addVolunteer(req.user.tenantId, eventId, body.memberId, body.role, getBranchId(req));
  }

  @Put("volunteers/:scheduleId/status")
  updateVolunteerStatus(
    @Param("scheduleId") id: string,
    @Request() req: AuthRequest,
    @Body("status") status: string,
  ) {
    return this.service.updateVolunteerStatus(id, req.user.tenantId, status, getBranchId(req));
  }

  @Delete("volunteers/:scheduleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVolunteer(@Param("scheduleId") id: string, @Request() req: AuthRequest) {
    return this.service.removeVolunteer(id, req.user.tenantId, getBranchId(req));
  }
}
