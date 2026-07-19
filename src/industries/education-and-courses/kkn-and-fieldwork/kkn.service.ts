import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

type KknTier = "starter" | "growth" | "pro" | "enterprise";
type KknContext = {
  tenantId: string;
  branchId?: string | null;
  branchScope: "single" | "all";
  userId?: string | null;
};
type AuditMeta = { ip?: string; userAgent?: string };

const TIER_RANK: Record<KknTier, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4
};

@Injectable()
export class KknService {
  constructor(private readonly prisma: PrismaService) {}

  // ── KKN Periods ────────────────────────────────────────────

  async listKknPeriods(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusKknPeriod.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { groups: true } } }
    });
  }

  async createKknPeriod(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const period = await this.prisma.campusKknPeriod.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        name: this.required(body.name, "Nama periode KKN wajib diisi."),
        academicYear: this.string(body.academicYear),
        startDate: this.date(body.startDate),
        endDate: this.date(body.endDate),
        status: this.string(body.status) ?? "active"
      }
    });
    await this.audit(context, "campus.kkn.period.create", "campus", "CampusKknPeriod", period.id, null, period, meta);
    return period;
  }

  // ── KKN Groups ─────────────────────────────────────────────

  async listKknGroups(user: any, periodId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusKknGroup.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(periodId ? { periodId } : {}) },
      orderBy: { code: "asc" },
      include: { location: true, members: { include: { student: true } }, _count: { select: { logbooks: true, reports: true } } }
    });
  }

  async createKknGroup(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const group = await this.prisma.campusKknGroup.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        periodId: this.required(body.periodId, "Periode KKN wajib dipilih."),
        locationId: this.string(body.locationId),
        code: this.required(body.code, "Kode kelompok wajib diisi."),
        supervisorName: this.string(body.supervisorName),
        status: this.string(body.status) ?? "active"
      }
    });
    await this.audit(context, "campus.kkn.group.create", "campus", "CampusKknGroup", group.id, null, group, meta);
    return group;
  }

  async addKknGroupMember(user: any, groupId: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const member = await this.prisma.campusKknGroupMember.create({
      data: {
        groupId,
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        role: this.string(body.role) ?? "member"
      }
    });
    await this.audit(context, "campus.kkn.member.add", "campus", "CampusKknGroupMember", member.id, null, member, meta);
    return member;
  }

  // ── KKN Locations ──────────────────────────────────────────

  async listKknLocations(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusKknLocation.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { name: "asc" },
      include: { _count: { select: { groups: true } } }
    });
  }

  async createKknLocation(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const location = await this.prisma.campusKknLocation.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        name: this.required(body.name, "Nama lokasi wajib diisi."),
        address: this.string(body.address),
        coordinator: this.string(body.coordinator),
        capacity: this.integer(body.capacity) ?? 20
      }
    });
    await this.audit(context, "campus.kkn.location.create", "campus", "CampusKknLocation", location.id, null, location, meta);
    return location;
  }

  // ── KKN Logbook ────────────────────────────────────────────

  async listKknLogbook(user: any, groupId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusKknLogbook.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(groupId ? { groupId } : {}) },
      orderBy: { date: "desc" },
      include: { group: true },
      take: 100
    });
  }

  async createKknLogbook(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const logbook = await this.prisma.campusKknLogbook.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        groupId: this.required(body.groupId, "Kelompok KKN wajib dipilih."),
        date: this.date(body.date) ?? new Date(),
        activity: this.required(body.activity, "Kegiatan wajib diisi."),
        evidence: this.string(body.evidence),
        notes: this.string(body.notes)
      }
    });
    await this.audit(context, "campus.kkn.logbook.create", "campus", "CampusKknLogbook", logbook.id, null, logbook, meta);
    return logbook;
  }

  // ── KKN Reports ────────────────────────────────────────────

  async listKknReports(user: any, groupId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    return this.prisma.campusKknReport.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(groupId ? { groupId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { group: { include: { location: true } } },
      take: 100
    });
  }

  async createKknReport(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const report = await this.prisma.campusKknReport.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        groupId: this.required(body.groupId, "Kelompok KKN wajib dipilih."),
        title: this.required(body.title, "Judul laporan wajib diisi."),
        fileUrl: this.string(body.fileUrl),
        status: this.string(body.status) ?? "draft"
      }
    });
    await this.audit(context, "campus.kkn.report.create", "campus", "CampusKknReport", report.id, null, report, meta);
    return report;
  }

  // ── Private helpers ────────────────────────────────────────

  private context(user: any): KknContext {
    const tenantId = user?.activeTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context missing.");
    return {
      tenantId,
      branchId: user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined,
      branchScope: user?.branchScope === "all" ? "all" : "single",
      userId: user?.id ?? null
    };
  }

  private branchWhere(context: KknContext) {
    return context.branchScope === "all" ? {} : { branchId: context.branchId ?? null };
  }

  private async activeTier(context: KknContext): Promise<KknTier> {
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

  private async requireTier(context: KknContext, minimum: KknTier) {
    const active = await this.activeTier(context);
    if (TIER_RANK[active] < TIER_RANK[minimum]) {
      throw new ForbiddenException(`Campus ${minimum} tier required.`);
    }
  }

  private async audit(context: KknContext, action: string, module: string, entityType?: string, entityId?: string | null, before?: unknown, after?: unknown, meta?: AuditMeta) {
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
