import { Body, Controller, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../../../common/request-meta";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { ClinicOpsService } from "./clinic-ops.service";

@Controller("tenant/clinic")
@UseGuards(AuthGuard("jwt"), PermissionGuard)
export class ClinicOpsController {
  constructor(private readonly service: ClinicOpsService) {}

  @Get("dashboard")
  @RequirePermission("clinic.patient.read")
  dashboard(@Request() request: { user: any }) {
    return this.service.dashboard(request.user);
  }

  @Get("patients")
  @RequirePermission("clinic.patient.read")
  patients(@Request() request: { user: any }, @Query("search") search?: string) {
    return this.service.listPatients(request.user, search);
  }

  @Post("patients")
  @RequirePermission("clinic.patient.write")
  createPatient(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createPatient(request.user, body, getRequestMeta(req));
  }

  @Patch("patients/:id")
  @RequirePermission("clinic.patient.write")
  updatePatient(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updatePatient(request.user, id, body, getRequestMeta(req));
  }

  @Get("services")
  @RequirePermission("clinic.appointment.read")
  services(@Request() request: { user: any }) {
    return this.service.listServices(request.user);
  }

  @Post("services")
  @RequirePermission("clinic.appointment.write")
  createService(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createService(request.user, body, getRequestMeta(req));
  }

  @Patch("services/:id")
  @RequirePermission("clinic.appointment.write")
  updateService(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateService(request.user, id, body, getRequestMeta(req));
  }

  @Get("appointments")
  @RequirePermission("clinic.appointment.read")
  appointments(@Request() request: { user: any }) {
    return this.service.listAppointments(request.user);
  }

  @Post("appointments")
  @RequirePermission("clinic.appointment.write")
  createAppointment(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createAppointment(request.user, body, getRequestMeta(req));
  }

  @Patch("appointments/:id")
  @RequirePermission("clinic.appointment.write")
  updateAppointment(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateAppointment(request.user, id, body, getRequestMeta(req));
  }

  @Get("queue")
  @RequirePermission("clinic.queue.read")
  queue(@Request() request: { user: any }) {
    return this.service.listQueue(request.user);
  }

  @Patch("queue/:id")
  @RequirePermission("clinic.queue.write")
  updateQueue(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateQueue(request.user, id, body, getRequestMeta(req));
  }

  @Get("visits")
  @RequirePermission("clinic.visit.read")
  visits(@Request() request: { user: any }) {
    return this.service.listVisits(request.user);
  }

  @Post("visits")
  @RequirePermission("clinic.visit.write")
  createVisit(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createVisit(request.user, body, getRequestMeta(req));
  }

  @Patch("visits/:id")
  @RequirePermission("clinic.visit.write")
  updateVisit(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateVisit(request.user, id, body, getRequestMeta(req));
  }

  @Patch("visits/:id/finalize")
  @RequirePermission("clinic.visit.finalize")
  finalizeVisit(@Request() request: { user: any }, @Param("id") id: string, @Req() req: ExpressRequest) {
    return this.service.finalizeVisit(request.user, id, getRequestMeta(req));
  }

  @Get("prescriptions")
  @RequirePermission("clinic.prescription.read")
  prescriptions(@Request() request: { user: any }) {
    return this.service.listPrescriptions(request.user);
  }

  @Post("prescriptions")
  @RequirePermission("clinic.prescription.write")
  createPrescription(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createPrescription(request.user, body, getRequestMeta(req));
  }

  @Patch("prescriptions/:id/dispense")
  @RequirePermission("clinic.prescription.dispense")
  dispensePrescription(@Request() request: { user: any }, @Param("id") id: string, @Req() req: ExpressRequest) {
    return this.service.dispensePrescription(request.user, id, getRequestMeta(req));
  }

  @Get("pharmacy")
  @RequirePermission("clinic.pharmacy.read")
  pharmacy(@Request() request: { user: any }) {
    return this.service.pharmacy(request.user);
  }

  @Post("pharmacy/drugs")
  @RequirePermission("clinic.pharmacy.write")
  createDrug(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createDrug(request.user, body, getRequestMeta(req));
  }

  @Post("pharmacy/stock-adjustments")
  @RequirePermission("clinic.pharmacy.write")
  adjustStock(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.adjustStock(request.user, body, getRequestMeta(req));
  }

  @Post("pharmacy/purchase-orders")
  @RequirePermission("clinic.pharmacy.write")
  createPurchaseOrder(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createPurchaseOrder(request.user, body, getRequestMeta(req));
  }

  @Post("pharmacy/stock-opnames")
  @RequirePermission("clinic.pharmacy.write")
  createStockOpname(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createStockOpname(request.user, body, getRequestMeta(req));
  }

  @Get("billing")
  @RequirePermission("clinic.cashier.read")
  invoices(@Request() request: { user: any }) {
    return this.service.listInvoices(request.user);
  }

  @Post("billing")
  @RequirePermission("clinic.cashier.write")
  createInvoice(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createInvoice(request.user, body, getRequestMeta(req));
  }

  @Patch("billing/:id/pay")
  @RequirePermission("clinic.payment.write")
  payInvoice(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.payInvoice(request.user, id, body, getRequestMeta(req));
  }

  @Patch("billing/:id/refund")
  @RequirePermission("clinic.cashier.refund")
  refundInvoice(@Request() request: { user: any }, @Param("id") id: string, @Req() req: ExpressRequest) {
    return this.service.refundInvoice(request.user, id, getRequestMeta(req));
  }

  @Post("cashier/closing")
  @RequirePermission("clinic.cashier.close")
  closeCashier(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.closeCashier(request.user, body, getRequestMeta(req));
  }

  @Get("finance")
  @RequirePermission("clinic.finance.read")
  finance(@Request() request: { user: any }) {
    return this.service.finance(request.user);
  }

  @Get("transfers")
  @RequirePermission("clinic.integration.read")
  transfers(@Request() request: { user: any }) {
    return this.service.listTransfers(request.user);
  }

  @Post("transfers")
  @RequirePermission("clinic.integration.write")
  createTransfer(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createTransfer(request.user, body, getRequestMeta(req));
  }

  @Get("lab-mailbox")
  @RequirePermission("clinic.integration.read")
  labMailbox(@Request() request: { user: any }) {
    return this.service.labMailbox(request.user);
  }

  @Post("lab-mailbox")
  @RequirePermission("clinic.integration.write")
  createLabMessage(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createLabMessage(request.user, body, getRequestMeta(req));
  }

  @Get("satusehat-sync")
  @RequirePermission("clinic.integration.read")
  satuSehatLogs(@Request() request: { user: any }) {
    return this.service.satuSehatLogs(request.user);
  }

  @Post("satusehat-sync")
  @RequirePermission("clinic.integration.sync")
  createSatuSehatSync(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createSatuSehatSync(request.user, body, getRequestMeta(req));
  }
}
