import { Body, Controller, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../../../common/request-meta";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { AcademicService } from "./academic.service";

@Controller("tenant/academic")
@UseGuards(AuthGuard("jwt"), PermissionGuard)
export class AcademicController {
  constructor(private readonly service: AcademicService) {}

  // ── Academic Requests ──────────────────────────────────────
  @Get("academic-requests")
  @RequirePermission("campus.academic.read")
  academicRequests(@Request() request: { user: any }) {
    return this.service.listAcademicRequests(request.user);
  }

  @Post("academic-requests")
  @RequirePermission("campus.academic.write")
  createAcademicRequest(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createAcademicRequest(request.user, body, getRequestMeta(req));
  }

  @Patch("academic-requests/:id")
  @RequirePermission("campus.academic.write")
  updateAcademicRequest(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateAcademicRequest(request.user, id, body, getRequestMeta(req));
  }

  // ── Documents ──────────────────────────────────────────────
  @Get("documents")
  @RequirePermission("campus.document.read")
  documents(@Request() request: { user: any }, @Query("requestId") requestId?: string) {
    return this.service.listDocuments(request.user, requestId);
  }

  @Post("documents")
  @RequirePermission("campus.document.write")
  createDocument(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createDocument(request.user, body, getRequestMeta(req));
  }

  // ── Approvals ──────────────────────────────────────────────
  @Get("approvals")
  @RequirePermission("campus.approval.read")
  approvals(@Request() request: { user: any }) {
    return this.service.listApprovals(request.user);
  }

  @Patch("approvals/:id")
  @RequirePermission("campus.approval.write")
  decideApproval(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.decideApproval(request.user, id, body, getRequestMeta(req));
  }

  // ── Billing ────────────────────────────────────────────────
  @Get("billing")
  @RequirePermission("campus.billing.read")
  invoices(@Request() request: { user: any }) {
    return this.service.listInvoices(request.user);
  }

  @Post("billing")
  @RequirePermission("campus.billing.write")
  createInvoice(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createInvoice(request.user, body, getRequestMeta(req));
  }

  @Post("billing/:id/pay")
  @RequirePermission("campus.payment.write")
  payInvoice(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.payInvoice(request.user, id, body, getRequestMeta(req));
  }

  // ── Announcements ──────────────────────────────────────────
  @Get("announcements")
  @RequirePermission("campus.announcement.read")
  announcements(@Request() request: { user: any }) {
    return this.service.listAnnouncements(request.user);
  }

  @Post("announcements")
  @RequirePermission("campus.announcement.write")
  createAnnouncement(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createAnnouncement(request.user, body, getRequestMeta(req));
  }
}
