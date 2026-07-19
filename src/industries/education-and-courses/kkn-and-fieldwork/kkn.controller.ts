import { Body, Controller, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../../../common/request-meta";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { KknService } from "./kkn.service";

@Controller("tenant/kkn")
@UseGuards(AuthGuard("jwt"), PermissionGuard)
export class KknController {
  constructor(private readonly service: KknService) {}

  // ── KKN Periods ────────────────────────────────────────────
  @Get("kkn/periods")
  @RequirePermission("campus.kkn.read")
  kknPeriods(@Request() request: { user: any }) {
    return this.service.listKknPeriods(request.user);
  }

  @Post("kkn/periods")
  @RequirePermission("campus.kkn.write")
  createKknPeriod(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createKknPeriod(request.user, body, getRequestMeta(req));
  }

  // ── KKN Groups ─────────────────────────────────────────────
  @Get("kkn/groups")
  @RequirePermission("campus.kkn.read")
  kknGroups(@Request() request: { user: any }, @Query("periodId") periodId?: string) {
    return this.service.listKknGroups(request.user, periodId);
  }

  @Post("kkn/groups")
  @RequirePermission("campus.kkn.write")
  createKknGroup(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createKknGroup(request.user, body, getRequestMeta(req));
  }

  @Post("kkn/groups/:id/members")
  @RequirePermission("campus.kkn.write")
  addKknGroupMember(@Request() request: { user: any }, @Param("id") groupId: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.addKknGroupMember(request.user, groupId, body, getRequestMeta(req));
  }

  // ── KKN Locations ──────────────────────────────────────────
  @Get("kkn/locations")
  @RequirePermission("campus.kkn.read")
  kknLocations(@Request() request: { user: any }) {
    return this.service.listKknLocations(request.user);
  }

  @Post("kkn/locations")
  @RequirePermission("campus.kkn.write")
  createKknLocation(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createKknLocation(request.user, body, getRequestMeta(req));
  }

  // ── KKN Logbook ────────────────────────────────────────────
  @Get("kkn/logbook")
  @RequirePermission("campus.kkn.read")
  kknLogbook(@Request() request: { user: any }, @Query("groupId") groupId?: string) {
    return this.service.listKknLogbook(request.user, groupId);
  }

  @Post("kkn/logbook")
  @RequirePermission("campus.kkn.write")
  createKknLogbook(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createKknLogbook(request.user, body, getRequestMeta(req));
  }

  // ── KKN Reports ────────────────────────────────────────────
  @Get("kkn/reports")
  @RequirePermission("campus.kkn.read")
  kknReports(@Request() request: { user: any }, @Query("groupId") groupId?: string) {
    return this.service.listKknReports(request.user, groupId);
  }

  @Post("kkn/reports")
  @RequirePermission("campus.kkn.write")
  createKknReport(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createKknReport(request.user, body, getRequestMeta(req));
  }

}
