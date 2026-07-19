import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

type ClinicTier = "starter" | "growth" | "pro" | "enterprise";
type ClinicContext = {
  tenantId: string;
  branchId?: string | null;
  branchScope: "single" | "all";
  userId?: string | null;
};
type AuditMeta = { ip?: string; userAgent?: string };

const TIER_RANK: Record<ClinicTier, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4
};

@Injectable()
export class ClinicOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const where = this.branchWhere(context);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [patients, appointmentsToday, waitingQueue, openVisits, finalizedToday, lowStocks, expiringStocks, paidToday] = await Promise.all([
      this.prisma.clinicPatient.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.clinicAppointment.count({
        where: { tenantId: context.tenantId, ...where, scheduledAt: { gte: today, lt: tomorrow } }
      }),
      this.prisma.clinicQueueTicket.count({ where: { tenantId: context.tenantId, ...where, status: { in: ["waiting", "called"] } } }),
      this.prisma.clinicVisit.count({ where: { tenantId: context.tenantId, ...where, status: "open" } }),
      this.prisma.clinicVisit.count({
        where: { tenantId: context.tenantId, ...where, status: "finalized", finalizedAt: { gte: today, lt: tomorrow } }
      }),
      this.prisma.clinicDrugStock.count({
        where: { tenantId: context.tenantId, ...where, quantity: { lte: 10 } }
      }),
      this.prisma.clinicDrugStock.count({
        where: { tenantId: context.tenantId, ...where, expiryDate: { lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } }
      }),
      this.prisma.clinicPayment.aggregate({
        where: { tenantId: context.tenantId, ...where, paidAt: { gte: today, lt: tomorrow }, status: "paid" },
        _sum: { amount: true }
      })
    ]);

    const queue = await this.prisma.clinicQueueTicket.findMany({
      where: { tenantId: context.tenantId, ...where, status: { in: ["waiting", "called"] } },
      orderBy: { createdAt: "asc" },
      take: 8,
      include: { patient: true, appointment: { include: { service: true } } }
    });

    return {
      tier: await this.activeTier(context),
      stats: {
        patients,
        appointmentsToday,
        waitingQueue,
        openVisits,
        finalizedToday,
        lowStocks,
        expiringStocks,
        revenueToday: Number(paidToday._sum.amount ?? 0)
      },
      queue: queue.map((item) => this.mapQueue(item))
    };
  }

  async listPatients(user: any, search?: string) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.clinicPatient.findMany({
      where: {
        tenantId: context.tenantId,
        ...this.branchWhere(context),
        ...(search ? { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { medicalRecordNo: { contains: search, mode: "insensitive" } }, { phoneNumber: { contains: search, mode: "insensitive" } }] } : {})
      },
      orderBy: { updatedAt: "desc" },
      include: {
        appointments: { orderBy: { scheduledAt: "desc" }, take: 5, include: { service: true } },
        visits: { orderBy: { createdAt: "desc" }, take: 5, include: { service: true, prescriptions: { include: { items: true } } } },
        invoices: { orderBy: { issuedAt: "desc" }, take: 5 }
      },
      take: 100
    });
  }

  async createPatient(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const patient = await this.prisma.clinicPatient.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        medicalRecordNo: this.string(body.medicalRecordNo) ?? await this.nextMedicalRecordNo(context.tenantId),
        fullName: this.required(body.fullName, "Nama pasien wajib diisi."),
        gender: this.string(body.gender),
        dob: this.date(body.dob),
        phoneNumber: this.string(body.phoneNumber),
        identityNumber: this.string(body.identityNumber),
        address: this.string(body.address),
        bloodType: this.string(body.bloodType),
        allergyNotes: this.string(body.allergyNotes),
        metadata: this.jsonObject(body.metadata)
      }
    });
    await this.audit(context, "clinic.patient.create", "clinic", "ClinicPatient", patient.id, null, patient, meta);
    return patient;
  }

  async updatePatient(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.findPatient(context, id);
    const after = await this.prisma.clinicPatient.update({
      where: { id },
      data: {
        fullName: this.string(body.fullName) ?? before.fullName,
        gender: this.string(body.gender) ?? before.gender,
        dob: body.dob === undefined ? before.dob : this.date(body.dob),
        phoneNumber: this.string(body.phoneNumber) ?? before.phoneNumber,
        identityNumber: this.string(body.identityNumber) ?? before.identityNumber,
        address: this.string(body.address) ?? before.address,
        bloodType: this.string(body.bloodType) ?? before.bloodType,
        allergyNotes: this.string(body.allergyNotes) ?? before.allergyNotes,
        status: this.string(body.status) ?? before.status,
        metadata: body.metadata === undefined ? before.metadata as Prisma.InputJsonValue : this.jsonObject(body.metadata)
      }
    });
    await this.audit(context, "clinic.patient.update", "clinic", "ClinicPatient", id, before, after, meta);
    return after;
  }

  async listServices(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.clinicService.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
  }

  async createService(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const service = await this.prisma.clinicService.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        name: this.required(body.name, "Nama layanan wajib diisi."),
        code: this.string(body.code),
        category: this.string(body.category) ?? "Poli",
        price: this.decimal(body.price),
        durationMin: this.integer(body.durationMin) ?? 30,
        metadata: this.jsonObject(body.metadata)
      }
    });
    await this.audit(context, "clinic.service.create", "clinic", "ClinicService", service.id, null, service, meta);
    return service;
  }

  async updateService(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.clinicService.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!before) throw new NotFoundException("Layanan tidak ditemukan.");
    const after = await this.prisma.clinicService.update({
      where: { id },
      data: {
        name: this.string(body.name) ?? before.name,
        code: this.string(body.code) ?? before.code,
        category: this.string(body.category) ?? before.category,
        price: body.price === undefined ? before.price : this.decimal(body.price),
        durationMin: this.integer(body.durationMin) ?? before.durationMin,
        isActive: this.boolean(body.isActive) ?? before.isActive
      }
    });
    await this.audit(context, "clinic.service.update", "clinic", "ClinicService", id, before, after, meta);
    return after;
  }

  async listAppointments(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.clinicAppointment.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { scheduledAt: "desc" },
      include: { patient: true, service: true, provider: true },
      take: 100
    });
  }

  async createAppointment(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    await this.findPatient(context, this.required(body.patientId, "Pasien wajib dipilih."));
    const appointment = await this.prisma.clinicAppointment.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        patientId: this.required(body.patientId, "Pasien wajib dipilih."),
        serviceId: this.string(body.serviceId),
        providerEmployeeId: this.string(body.providerEmployeeId),
        scheduledAt: this.date(body.scheduledAt) ?? new Date(),
        queueNumber: this.string(body.queueNumber),
        status: this.string(body.status) ?? "scheduled",
        source: this.string(body.source) ?? "internal",
        notes: this.string(body.notes)
      },
      include: { patient: true, service: true }
    });
    await this.audit(context, "clinic.appointment.create", "clinic", "ClinicAppointment", appointment.id, null, appointment, meta);
    return appointment;
  }

  async updateAppointment(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.clinicAppointment.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!before) throw new NotFoundException("Appointment tidak ditemukan.");
    const status = this.string(body.status) ?? before.status;
    const after = await this.prisma.clinicAppointment.update({
      where: { id },
      data: {
        scheduledAt: body.scheduledAt === undefined ? before.scheduledAt : this.date(body.scheduledAt) ?? before.scheduledAt,
        serviceId: this.string(body.serviceId) ?? before.serviceId,
        providerEmployeeId: this.string(body.providerEmployeeId) ?? before.providerEmployeeId,
        status,
        reminderStatus: this.string(body.reminderStatus) ?? before.reminderStatus,
        notes: this.string(body.notes) ?? before.notes
      },
      include: { patient: true, service: true }
    });
    if (status === "checked_in") await this.ensureQueueForAppointment(context, after.id);
    await this.audit(context, "clinic.appointment.update", "clinic", "ClinicAppointment", id, before, after, meta);
    return after;
  }

  async listQueue(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const tickets = await this.prisma.clinicQueueTicket.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "asc" },
      include: { patient: true, appointment: { include: { service: true } } },
      take: 100
    });
    return tickets.map((ticket) => this.mapQueue(ticket));
  }

  async updateQueue(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.clinicQueueTicket.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!before) throw new NotFoundException("Nomor antrean tidak ditemukan.");
    const status = this.string(body.status) ?? before.status;
    const after = await this.prisma.clinicQueueTicket.update({
      where: { id },
      data: {
        status,
        station: this.string(body.station) ?? before.station,
        calledAt: status === "called" ? new Date() : before.calledAt,
        completedAt: ["done", "completed"].includes(status) ? new Date() : before.completedAt
      },
      include: { patient: true, appointment: { include: { service: true } } }
    });
    await this.audit(context, "clinic.queue.update", "clinic", "ClinicQueueTicket", id, before, after, meta);
    return this.mapQueue(after);
  }

  async listVisits(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.clinicVisit.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      include: this.visitInclude(),
      take: 100
    });
  }

  async createVisit(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const patientId = this.required(body.patientId, "Pasien wajib dipilih.");
    await this.findPatient(context, patientId);
    const visit = await this.prisma.clinicVisit.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        patientId,
        appointmentId: this.string(body.appointmentId),
        serviceId: this.string(body.serviceId),
        providerEmployeeId: this.string(body.providerEmployeeId),
        nurseEmployeeId: this.string(body.nurseEmployeeId),
        chiefComplaint: this.string(body.chiefComplaint),
        metadata: this.jsonObject(body.metadata)
      },
      include: this.visitInclude()
    });
    await this.audit(context, "clinic.visit.create", "clinic", "ClinicVisit", visit.id, null, visit, meta);
    return visit;
  }

  async updateVisit(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const before = await this.findVisit(context, id);
    const after = await this.prisma.$transaction(async (tx) => {
      await tx.clinicVisit.update({
        where: { id },
        data: {
          serviceId: this.string(body.serviceId) ?? before.serviceId,
          providerEmployeeId: this.string(body.providerEmployeeId) ?? before.providerEmployeeId,
          nurseEmployeeId: this.string(body.nurseEmployeeId) ?? before.nurseEmployeeId,
          chiefComplaint: this.string(body.chiefComplaint) ?? before.chiefComplaint,
          followUpAt: body.followUpAt === undefined ? before.followUpAt : this.date(body.followUpAt),
          metadata: body.metadata === undefined ? before.metadata as Prisma.InputJsonValue : this.jsonObject(body.metadata)
        }
      });
      if (this.isObject(body.vital)) {
        await tx.clinicVisitVital.upsert({
          where: { visitId: id },
          create: { visitId: id, ...this.vitalData(body.vital as Record<string, unknown>) },
          update: this.vitalData(body.vital as Record<string, unknown>)
        });
      }
      if (this.isObject(body.soap)) {
        await tx.clinicVisitSoap.upsert({
          where: { visitId: id },
          create: { visitId: id, ...this.soapData(body.soap as Record<string, unknown>) },
          update: this.soapData(body.soap as Record<string, unknown>)
        });
      }
      if (Array.isArray(body.diagnoses)) {
        await tx.clinicDiagnosis.deleteMany({ where: { visitId: id } });
        await tx.clinicDiagnosis.createMany({
          data: body.diagnoses.map((item) => ({
            visitId: id,
            code: this.string((item as any).code),
            name: this.required((item as any).name, "Nama diagnosis wajib diisi."),
            type: this.string((item as any).type) ?? "primary",
            notes: this.string((item as any).notes)
          }))
        });
      }
      if (Array.isArray(body.treatments)) {
        await tx.clinicTreatment.deleteMany({ where: { visitId: id } });
        await tx.clinicTreatment.createMany({
          data: body.treatments.map((item) => ({
            visitId: id,
            name: this.required((item as any).name, "Nama tindakan wajib diisi."),
            description: this.string((item as any).description),
            price: this.decimal((item as any).price)
          }))
        });
      }
      return tx.clinicVisit.findUniqueOrThrow({ where: { id }, include: this.visitInclude() });
    });
    await this.audit(context, "clinic.visit.update", "clinic", "ClinicVisit", id, before, after, meta);
    return after;
  }

  async finalizeVisit(user: any, id: string, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const before = await this.findVisit(context, id);
    const after = await this.prisma.clinicVisit.update({
      where: { id },
      data: { status: "finalized", finalizedAt: new Date() },
      include: this.visitInclude()
    });
    await this.audit(context, "clinic.visit.finalize", "clinic", "ClinicVisit", id, before, after, meta);
    return after;
  }

  async listPrescriptions(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.clinicPrescription.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { issuedAt: "desc" },
      include: { patient: true, visit: true, items: { include: { drug: true } } },
      take: 100
    });
  }

  async createPrescription(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const patientId = this.required(body.patientId, "Pasien wajib dipilih.");
    await this.findPatient(context, patientId);
    const prescription = await this.prisma.clinicPrescription.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        patientId,
        visitId: this.string(body.visitId),
        notes: this.string(body.notes),
        items: { create: this.prescriptionItems(body.items) }
      },
      include: { patient: true, items: { include: { drug: true } } }
    });
    await this.audit(context, "clinic.prescription.issue", "clinic", "ClinicPrescription", prescription.id, null, prescription, meta);
    return prescription;
  }

  async dispensePrescription(user: any, id: string, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const before = await this.prisma.clinicPrescription.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) }, include: { items: true } });
    if (!before) throw new NotFoundException("Resep tidak ditemukan.");
    const after = await this.prisma.clinicPrescription.update({ where: { id }, data: { status: "dispensed", dispensedAt: new Date() }, include: { items: true } });
    await this.audit(context, "clinic.prescription.dispense", "clinic", "ClinicPrescription", id, before, after, meta);
    return after;
  }

  async pharmacy(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const [drugs, movements, purchaseOrders, stockOpnames] = await Promise.all([
      this.prisma.clinicDrug.findMany({
        where: { tenantId: context.tenantId, ...this.branchWhere(context) },
        include: { stocks: true },
        orderBy: { name: "asc" }
      }),
      this.prisma.clinicDrugMovement.findMany({ where: { tenantId: context.tenantId, ...this.branchWhere(context) }, include: { drug: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.clinicPurchaseOrder.findMany({ where: { tenantId: context.tenantId, ...this.branchWhere(context) }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.clinicStockOpname.findMany({ where: { tenantId: context.tenantId, ...this.branchWhere(context) }, orderBy: { createdAt: "desc" }, take: 50 })
    ]);
    return { drugs, movements, purchaseOrders, stockOpnames };
  }

  async createDrug(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const drug = await this.prisma.clinicDrug.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        sku: this.string(body.sku),
        name: this.required(body.name, "Nama obat wajib diisi."),
        unit: this.string(body.unit) ?? "pcs",
        costPrice: this.decimal(body.costPrice),
        salePrice: this.decimal(body.salePrice),
        minStock: this.decimal(body.minStock),
        expiryDate: this.date(body.expiryDate)
      }
    });
    await this.audit(context, "clinic.pharmacy.drug.create", "clinic", "ClinicDrug", drug.id, null, drug, meta);
    return drug;
  }

  async adjustStock(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const drugId = this.required(body.drugId, "Obat wajib dipilih.");
    const quantity = this.decimal(body.quantity);
    const branchId = context.branchId ?? await this.defaultBranchId(context.tenantId);
    const result = await this.prisma.$transaction(async (tx) => {
      const stock = await tx.clinicDrugStock.upsert({
        where: { branchId_drugId_batchNo: { branchId, drugId, batchNo: this.string(body.batchNo) ?? "" } },
        create: {
          tenantId: context.tenantId,
          branchId,
          drugId,
          batchNo: this.string(body.batchNo) ?? "",
          expiryDate: this.date(body.expiryDate),
          quantity
        },
        update: { quantity: { increment: quantity }, expiryDate: this.date(body.expiryDate) ?? undefined }
      });
      const movement = await tx.clinicDrugMovement.create({
        data: {
          tenantId: context.tenantId,
          branchId,
          drugId,
          type: this.string(body.type) ?? "adjustment",
          quantity,
          reference: this.string(body.reference),
          notes: this.string(body.notes)
        }
      });
      return { stock, movement };
    });
    await this.audit(context, "clinic.pharmacy.stock.adjust", "clinic", "ClinicDrugStock", result.stock.id, null, result, meta);
    return result;
  }

  async createPurchaseOrder(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const purchaseOrder = await this.prisma.clinicPurchaseOrder.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        poNumber: this.string(body.poNumber) ?? `PO-${Date.now()}`,
        vendorName: this.required(body.vendorName, "Vendor wajib diisi."),
        status: this.string(body.status) ?? "draft",
        totalAmount: this.decimal(body.totalAmount)
      }
    });
    await this.audit(context, "clinic.pharmacy.po.create", "clinic", "ClinicPurchaseOrder", purchaseOrder.id, null, purchaseOrder, meta);
    return purchaseOrder;
  }

  async createStockOpname(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const opname = await this.prisma.clinicStockOpname.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        code: this.string(body.code) ?? `SO-${Date.now()}`,
        status: this.string(body.status) ?? "draft",
        notes: this.string(body.notes)
      }
    });
    await this.audit(context, "clinic.pharmacy.opname.create", "clinic", "ClinicStockOpname", opname.id, null, opname, meta);
    return opname;
  }

  async listInvoices(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.clinicInvoice.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { issuedAt: "desc" },
      include: { patient: true, items: true, payments: true },
      take: 100
    });
  }

  async createInvoice(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const items = this.invoiceItems(body.items);
    const totalAmount = items.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const invoice = await this.prisma.clinicInvoice.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        patientId: this.required(body.patientId, "Pasien wajib dipilih."),
        visitId: this.string(body.visitId),
        invoiceNumber: this.string(body.invoiceNumber) ?? `INV-KLN-${Date.now()}`,
        status: "issued",
        totalAmount,
        items: { create: items }
      },
      include: { patient: true, items: true }
    });
    await this.audit(context, "clinic.invoice.create", "clinic", "ClinicInvoice", invoice.id, null, invoice, meta);
    return invoice;
  }

  async payInvoice(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const before = await this.prisma.clinicInvoice.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!before) throw new NotFoundException("Invoice tidak ditemukan.");
    const amount = this.decimal(body.amount);
    const after = await this.prisma.$transaction(async (tx) => {
      await tx.clinicPayment.create({
        data: {
          tenantId: context.tenantId,
          branchId: before.branchId,
          invoiceId: id,
          amount,
          method: this.string(body.method) ?? "cash",
          reference: this.string(body.reference)
        }
      });
      return tx.clinicInvoice.update({
        where: { id },
        data: { paidAmount: { increment: amount }, status: "paid", paidAt: new Date() },
        include: { patient: true, items: true, payments: true }
      });
    });
    await this.audit(context, "clinic.invoice.pay", "clinic", "ClinicInvoice", id, before, after, meta);
    return after;
  }

  async refundInvoice(user: any, id: string, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const before = await this.prisma.clinicInvoice.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!before) throw new NotFoundException("Invoice tidak ditemukan.");
    const after = await this.prisma.clinicInvoice.update({ where: { id }, data: { status: "refunded" }, include: { payments: true } });
    await this.audit(context, "clinic.invoice.refund", "clinic", "ClinicInvoice", id, before, after, meta);
    return after;
  }

  async closeCashier(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const closing = await this.prisma.clinicCashierClosing.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        cashierUserId: context.userId,
        periodDate: this.date(body.periodDate) ?? new Date(),
        systemAmount: this.decimal(body.systemAmount),
        actualAmount: this.decimal(body.actualAmount),
        notes: this.string(body.notes)
      }
    });
    await this.audit(context, "clinic.cashier.close", "clinic", "ClinicCashierClosing", closing.id, null, closing, meta);
    return closing;
  }

  async finance(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const paid = await this.prisma.clinicPayment.aggregate({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), status: "paid" },
      _sum: { amount: true },
      _count: true
    });
    const outstanding = await this.prisma.clinicInvoice.aggregate({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), status: { notIn: ["paid", "refunded"] } },
      _sum: { totalAmount: true },
      _count: true
    });
    return {
      revenue: Number(paid._sum.amount ?? 0),
      paymentCount: paid._count,
      outstanding: Number(outstanding._sum.totalAmount ?? 0),
      outstandingCount: outstanding._count
    };
  }

  async listTransfers(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    return this.prisma.clinicPatientTransfer.findMany({
      where: { tenantId: context.tenantId },
      include: { patient: true, fromBranch: true, toBranch: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createTransfer(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    const transfer = await this.prisma.clinicPatientTransfer.create({
      data: {
        tenantId: context.tenantId,
        patientId: this.required(body.patientId, "Pasien wajib dipilih."),
        fromBranchId: this.string(body.fromBranchId) ?? context.branchId ?? null,
        toBranchId: this.string(body.toBranchId),
        notes: this.string(body.notes)
      },
      include: { patient: true, fromBranch: true, toBranch: true }
    });
    await this.audit(context, "clinic.patient.transfer", "clinic", "ClinicPatientTransfer", transfer.id, null, transfer, meta);
    return transfer;
  }

  async labMailbox(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    return this.prisma.clinicLabMailboxMessage.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { receivedAt: "desc" },
      take: 100
    });
  }

  async createLabMessage(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    const message = await this.prisma.clinicLabMailboxMessage.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        vendor: this.string(body.vendor) ?? "Manual Lab",
        subject: this.required(body.subject, "Subject wajib diisi."),
        payload: this.jsonObject(body.payload)
      }
    });
    await this.audit(context, "clinic.lab.mailbox.create", "clinic", "ClinicLabMailboxMessage", message.id, null, message, meta);
    return message;
  }

  async satuSehatLogs(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    return this.prisma.clinicSatuSehatSyncLog.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async createSatuSehatSync(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "enterprise");
    const sync = await this.prisma.clinicSatuSehatSyncLog.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        entityType: this.string(body.entityType) ?? "Patient",
        entityId: this.string(body.entityId),
        status: "queued",
        requestJson: this.jsonObject(body.requestJson)
      }
    });
    await this.audit(context, "clinic.satusehat.sync.queue", "clinic", "ClinicSatuSehatSyncLog", sync.id, null, sync, meta);
    return sync;
  }

  private context(user: any): ClinicContext {
    const tenantId = user?.activeTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context missing.");
    return {
      tenantId,
      branchId: user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined,
      branchScope: user?.branchScope === "all" ? "all" : "single",
      userId: user?.id ?? null
    };
  }

  private branchWhere(context: ClinicContext) {
    return context.branchScope === "all" ? {} : { branchId: context.branchId ?? null };
  }

  private async activeTier(context: ClinicContext): Promise<ClinicTier> {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId: context.tenantId,
        status: { in: ["active", "trial", "subscribed"] },
        OR: [
          { subIndustry: { slug: { contains: "clinic", mode: "insensitive" } } },
          { subIndustry: { slug: { contains: "klinik", mode: "insensitive" } } },
          { subIndustry: { industry: { slug: { contains: "health", mode: "insensitive" } } } },
          { subIndustry: { industry: { name: { contains: "Klinik", mode: "insensitive" } } } }
        ]
      },
      include: { tier: true },
      orderBy: { createdAt: "desc" }
    });
    const raw = `${subscription?.tier?.slug ?? ""} ${subscription?.tier?.name ?? ""}`.toLowerCase();
    if (raw.includes("enterprise")) return "enterprise";
    if (raw.includes("pro")) return "pro";
    if (raw.includes("growth")) return "growth";
    if (raw.includes("starter")) return "starter";
    return "starter";
  }

  private async requireTier(context: ClinicContext, minimum: ClinicTier) {
    const active = await this.activeTier(context);
    if (TIER_RANK[active] < TIER_RANK[minimum]) {
      throw new ForbiddenException(`KlinikOps ${minimum} tier required.`);
    }
  }

  private async audit(context: ClinicContext, action: string, module: string, entityType?: string, entityId?: string | null, before?: unknown, after?: unknown, meta?: AuditMeta) {
    return this.prisma.tenantAuditLog.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? null,
        actorUserId: context.userId ?? null,
        action,
        module,
        entityType,
        entityId: entityId ?? null,
        before: before === undefined ? undefined : before as Prisma.InputJsonValue,
        after: after === undefined ? undefined : after as Prisma.InputJsonValue,
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 240)
      }
    });
  }

  private async defaultBranchId(tenantId: string) {
    const branch = await this.prisma.tenantBranch.findFirst({ where: { tenantId, status: "active" }, orderBy: { createdAt: "asc" } });
    if (!branch) throw new BadRequestException("Tenant belum memiliki cabang aktif.");
    return branch.id;
  }

  private async nextMedicalRecordNo(tenantId: string) {
    const count = await this.prisma.clinicPatient.count({ where: { tenantId } });
    return `RM-${String(count + 1).padStart(6, "0")}`;
  }

  private async findPatient(context: ClinicContext, id: string) {
    const patient = await this.prisma.clinicPatient.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) } });
    if (!patient) throw new NotFoundException("Pasien tidak ditemukan.");
    return patient;
  }

  private async findVisit(context: ClinicContext, id: string) {
    const visit = await this.prisma.clinicVisit.findFirst({ where: { id, tenantId: context.tenantId, ...this.branchWhere(context) }, include: this.visitInclude() });
    if (!visit) throw new NotFoundException("Kunjungan tidak ditemukan.");
    return visit;
  }

  private async ensureQueueForAppointment(context: ClinicContext, appointmentId: string) {
    const existing = await this.prisma.clinicQueueTicket.findFirst({ where: { appointmentId, tenantId: context.tenantId } });
    if (existing) return existing;
    const appointment = await this.prisma.clinicAppointment.findUniqueOrThrow({ where: { id: appointmentId } });
    const count = await this.prisma.clinicQueueTicket.count({ where: { tenantId: context.tenantId, branchId: appointment.branchId } });
    return this.prisma.clinicQueueTicket.create({
      data: {
        tenantId: context.tenantId,
        branchId: appointment.branchId,
        patientId: appointment.patientId,
        appointmentId,
        number: appointment.queueNumber ?? `A${String(count + 1).padStart(3, "0")}`
      }
    });
  }

  private visitInclude() {
    return {
      patient: true,
      service: true,
      provider: true,
      nurse: true,
      vital: true,
      soap: true,
      diagnoses: true,
      treatments: true,
      prescriptions: { include: { items: true } }
    } satisfies Prisma.ClinicVisitInclude;
  }

  private mapQueue(ticket: any) {
    return {
      id: ticket.id,
      number: ticket.number,
      status: ticket.status,
      station: ticket.station,
      calledAt: ticket.calledAt,
      completedAt: ticket.completedAt,
      createdAt: ticket.createdAt,
      patient: ticket.patient ? { id: ticket.patient.id, name: ticket.patient.fullName, medicalRecordNo: ticket.patient.medicalRecordNo } : null,
      service: ticket.appointment?.service ? { id: ticket.appointment.service.id, name: ticket.appointment.service.name } : null
    };
  }

  private prescriptionItems(value: unknown) {
    if (!Array.isArray(value) || !value.length) return [];
    return value.map((item: any) => ({
      drugId: this.string(item.drugId),
      name: this.required(item.name, "Nama item resep wajib diisi."),
      dosage: this.string(item.dosage),
      quantity: this.decimal(item.quantity) || 1,
      instructions: this.string(item.instructions)
    }));
  }

  private invoiceItems(value: unknown) {
    if (!Array.isArray(value) || !value.length) throw new BadRequestException("Item invoice wajib diisi.");
    return value.map((item: any) => {
      const quantity = Number(this.decimal(item.quantity) || 1);
      const unitPrice = Number(this.decimal(item.unitPrice));
      return {
        serviceId: this.string(item.serviceId),
        drugId: this.string(item.drugId),
        name: this.required(item.name, "Nama item invoice wajib diisi."),
        quantity,
        unitPrice,
        totalAmount: Number(item.totalAmount ?? quantity * unitPrice)
      };
    });
  }

  private vitalData(value: Record<string, unknown>) {
    return {
      temperature: this.optionalDecimal(value.temperature),
      systolic: this.integer(value.systolic),
      diastolic: this.integer(value.diastolic),
      pulse: this.integer(value.pulse),
      respiration: this.integer(value.respiration),
      weight: this.optionalDecimal(value.weight),
      height: this.optionalDecimal(value.height),
      oxygenSat: this.integer(value.oxygenSat)
    };
  }

  private soapData(value: Record<string, unknown>) {
    return {
      subjective: this.string(value.subjective),
      objective: this.string(value.objective),
      assessment: this.string(value.assessment),
      plan: this.string(value.plan)
    };
  }

  private required(value: unknown, message: string) {
    const parsed = this.string(value);
    if (!parsed) throw new BadRequestException(message);
    return parsed;
  }

  private string(value: unknown) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private integer(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : undefined;
  }

  private decimal(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  private optionalDecimal(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private date(value: unknown) {
    if (!value) return undefined;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : undefined;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  private jsonObject(value: unknown): Prisma.InputJsonObject {
    return this.isObject(value) ? value as Prisma.InputJsonObject : {};
  }
}
