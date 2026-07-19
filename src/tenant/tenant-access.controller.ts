import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../common/request-meta";
import { TenantAccessService } from "./tenant-access.service";

@Controller("tenant")
@UseGuards(AuthGuard("jwt"))
export class TenantAccessController {
  constructor(private readonly service: TenantAccessService) {}

  @Get("context")
  context(@Request() request: { user: any }) {
    return this.service.getContext(request.user);
  }

  @Get("branches")
  branches(@Request() request: { user: any }) {
    return this.service.listBranches(request.user);
  }

  @Post("branches")
  createBranch(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createBranch(request.user, body, getRequestMeta(req));
  }

  @Patch("branches/:id")
  updateBranch(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateBranch(request.user, id, body, getRequestMeta(req));
  }

  @Delete("branches/:id")
  deleteBranch(@Request() request: { user: any }, @Param("id") id: string, @Req() req: ExpressRequest) {
    return this.service.deleteBranch(request.user, id, getRequestMeta(req));
  }

  @Get("members")
  members(@Request() request: { user: any }) {
    return this.service.listMembers(request.user);
  }

  @Post("members")
  createMember(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createMember(request.user, body, getRequestMeta(req));
  }

  @Patch("members/:id")
  updateMember(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateMember(request.user, id, body, getRequestMeta(req));
  }

  @Get("roles")
  roles(@Request() request: { user: any }) {
    return this.service.listRoles(request.user);
  }

  @Post("roles")
  createRole(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createRole(request.user, body, getRequestMeta(req));
  }

  @Patch("roles/:id")
  updateRole(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateRole(request.user, id, body, getRequestMeta(req));
  }

  @Delete("roles/:id")
  deleteRole(@Request() request: { user: any }, @Param("id") id: string, @Req() req: ExpressRequest) {
    return this.service.deleteRole(request.user, id, getRequestMeta(req));
  }

  @Get("audit-logs")
  auditLogs(@Request() request: { user: any }, @Query() query: Record<string, unknown>) {
    return this.service.listAuditLogs(request.user, query);
  }
}
