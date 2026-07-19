import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

type AcademicTier = "starter" | "growth" | "pro" | "enterprise";
type AcademicContext = {
  tenantId: string;
  branchId?: string | null;
  branchScope: "single" | "all";
  userId?: string | null;
};
type AuditMeta = { ip?: string; userAgent?: string };

const TIER_RANK: Record<AcademicTier, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4
};

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Academic Requests ──────────────────────────────────────

  async listAcademicRequests(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.campusAcademicRequest.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      include: { student: true, approvals: true, documents: true },
      take: 100
    });
  }

  async createAcademicRequest(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const request = await this.prisma.campusAcademicRequest.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        type: this.required(body.type, "Jenis layanan wajib diisi."),
        description: this.string(body.description),
        owner: this.string(body.owner),
        sla: this.string(body.sla)
      }
    });
    await this.audit(context, "campus.academic.request.create", "campus", "CampusAcademicRequest", request.id, null, request, meta);
    return request;
  }

  async updateAcademicRequest(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const before = await this.prisma.campusAcademicRequest.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Pengajuan tidak ditemukan.");
    const status = this.string(body.status) ?? before.status;
    const after = await this.prisma.campusAcademicRequest.update({
      where: { id },
      data: {
        status,
        owner: this.string(body.owner) ?? before.owner,
        resolvedAt: ["approved", "ready", "rejected"].includes(status) ? new Date() : before.resolvedAt
      }
    });
    await this.audit(context, "campus.academic.request.update", "campus", "CampusAcademicRequest", id, before, after, meta);
    return after;
  }

  // ── Documents ──────────────────────────────────────────────

  async listDocuments(user: any, requestId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.campusDocument.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(requestId ? { requestId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async createDocument(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const doc = await this.prisma.campusDocument.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        requestId: this.string(body.requestId),
        name: this.required(body.name, "Nama dokumen wajib diisi."),
        fileUrl: this.string(body.fileUrl),
        category: this.string(body.category)
      }
    });
    await this.audit(context, "campus.document.create", "campus", "CampusDocument", doc.id, null, doc, meta);
    return doc;
  }

  // ── Approvals ──────────────────────────────────────────────

  async listApprovals(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.campusApproval.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      include: { request: { include: { student: true } } },
      take: 100
    });
  }

  async decideApproval(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const before = await this.prisma.campusApproval.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Approval tidak ditemukan.");
    const status = this.required(body.status, "Status wajib diisi.") as string;
    const after = await this.prisma.campusApproval.update({
      where: { id },
      data: {
        status,
        notes: this.string(body.notes),
        approverName: this.string(body.approverName),
        decidedAt: new Date()
      }
    });
    await this.audit(context, "campus.approval.decide", "campus", "CampusApproval", id, before, after, meta);
    return after;
  }

  // ── Billing ────────────────────────────────────────────────

  async listInvoices(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusInvoice.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { issuedAt: "desc" },
      include: { student: true, payments: true },
      take: 100
    });
  }

  async createInvoice(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const invoice = await this.prisma.campusInvoice.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        invoiceNumber: this.string(body.invoiceNumber) ?? `CAMPUS-INV-${Date.now()}`,
        description: this.string(body.description),
        totalAmount: this.decimal(body.totalAmount),
        dueDate: this.date(body.dueDate)
      }
    });
    await this.audit(context, "campus.invoice.create", "campus", "CampusInvoice", invoice.id, null, invoice, meta);
    return invoice;
  }

  async payInvoice(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const before = await this.prisma.campusInvoice.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Invoice tidak ditemukan.");
    const amount = this.decimal(body.amount);
    const after = await this.prisma.$transaction(async (tx) => {
      await tx.campusPayment.create({
        data: {
          tenantId: context.tenantId,
          branchId: before.branchId,
          invoiceId: id,
          amount,
          method: this.string(body.method) ?? "transfer",
          reference: this.string(body.reference)
        }
      });
      return tx.campusInvoice.update({
        where: { id },
        data: { paidAmount: { increment: amount }, status: "paid", paidAt: new Date() },
        include: { student: true, payments: true }
      });
    });
    await this.audit(context, "campus.invoice.pay", "campus", "CampusInvoice", id, before, after, meta);
    return after;
  }

  // ── Announcements ──────────────────────────────────────────

  async listAnnouncements(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusAnnouncement.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async createAnnouncement(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const announcement = await this.prisma.campusAnnouncement.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        facultyId: this.string(body.facultyId),
        title: this.required(body.title, "Judul pengumuman wajib diisi."),
        body: this.required(body.body, "Isi pengumuman wajib diisi."),
        category: this.string(body.category),
        priority: this.string(body.priority) ?? "normal",
        publishedAt: new Date()
      }
    });
    await this.audit(context, "campus.announcement.create", "campus", "CampusAnnouncement", announcement.id, null, announcement, meta);
    return announcement;
  }

  // ── Private helpers ────────────────────────────────────────

  private context(user: any): AcademicContext {
    const tenantId = user?.activeTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context missing.");
    return {
      tenantId,
      branchId: user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined,
      branchScope: user?.branchScope === "all" ? "all" : "single",
      userId: user?.id ?? null
    };
  }

  private branchWhere(context: AcademicContext) {
    return context.branchScope === "all" ? {} : { branchId: context.branchId ?? null };
  }

  private async activeTier(context: AcademicContext): Promise<AcademicTier> {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId: context.tenantId,
        status: { in: ["active", "trial", "subscribed"] },
        OR: [
          { subIndustry: { slug: { contains: "higher-education", mode: "insensitive" } } },
          { subIndustry: { name: { contains: "Higher Education", mode: "insensitive" } } },
          { subIndustry: { name: { contains: "Campus", mode: "insensitive" } } },
          { subIndustry: { industry: { slug: { contains: "pendidikan", mode: "insensitive" } } } }
        ]
      },
      include: { tier: true },
      orderBy: { createdAt: "desc" }
    });
    const raw = `${subscription?.tier?.slug ?? ""} ${subscription?.tier?.name ?? ""}`.toLowerCase();
    if (raw.includes("enterprise")) return "enterprise";
    if (raw.includes("pro") || raw.includes("business")) return "pro";
    if (raw.includes("growth")) return "growth";
    if (raw.includes("starter")) return "starter";
    return "starter";
  }

  private async requireTier(context: AcademicContext, minimum: AcademicTier) {
    const active = await this.activeTier(context);
    if (TIER_RANK[active] < TIER_RANK[minimum]) {
      throw new ForbiddenException(`Campus ${minimum} tier required.`);
    }
  }

  private async audit(context: AcademicContext, action: string, module: string, entityType?: string, entityId?: string | null, before?: unknown, after?: unknown, meta?: AuditMeta) {
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

  private required(value: unknown, message: string): string {
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) throw new BadRequestException(message);
    return str;
  }

  private string(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private integer(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return parseInt(value.trim(), 10);
    return undefined;
  }

  private decimal(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") { const num = parseFloat(value); if (Number.isFinite(num)) return num; }
    return 0;
  }

  private date(value: unknown): Date | undefined {
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim()) { const d = new Date(value); if (!isNaN(d.getTime())) return d; }
    return undefined;
  }

  private boolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    return undefined;
  }
}
