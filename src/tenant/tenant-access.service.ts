import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SYSTEM_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  admin: ["tenant.manage", "branch.manage", "member.manage", "role.manage", "audit.read", "billing.manage", "clinic.*", "hris.*"],
  employee: ["portal.read", "hris.self.read", "hris.self.write", "hris.loan.request"],
  hris_admin: ["hris.*", "branch.read", "audit.read"],
  hris_employee: ["portal.read", "hris.self.read", "hris.self.write", "hris.loan.request"],
  hris_payroll: ["portal.read", "hris.employee.read", "hris.payroll.read", "hris.payroll.write", "hris.loan.approve"],
  fnb_cashier: ["fnb.pos.read", "fnb.pos.write", "fnb.shift.write"],
  branch_manager: ["branch.read", "reports.read", "hris.read", "fnb.read"],
  clinic_admin: ["clinic.*", "audit.read", "branch.read"],
  clinic_doctor: ["clinic.patient.read", "clinic.appointment.read", "clinic.queue.read", "clinic.visit.read", "clinic.visit.write", "clinic.visit.finalize", "clinic.prescription.read", "clinic.prescription.write"],
  clinic_nurse: ["clinic.patient.read", "clinic.appointment.read", "clinic.queue.read", "clinic.queue.write", "clinic.visit.read", "clinic.visit.write"],
  clinic_cashier: ["clinic.patient.read", "clinic.cashier.read", "clinic.cashier.write", "clinic.cashier.refund", "clinic.cashier.close", "clinic.payment.write", "clinic.finance.read"],
  clinic_pharmacist: ["clinic.patient.read", "clinic.prescription.read", "clinic.prescription.dispense", "clinic.pharmacy.read", "clinic.pharmacy.write"],
  clinic_branch_manager: ["clinic.patient.read", "clinic.appointment.*", "clinic.queue.*", "clinic.visit.read", "clinic.prescription.read", "clinic.pharmacy.read", "clinic.cashier.read", "clinic.finance.read", "clinic.audit.read", "reports.read"]
};

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(user: any) {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId: user.id },
      include: {
        roleProfile: true,
        branchAccess: { include: { branch: true } },
        tenant: {
          include: {
            branches: { orderBy: { createdAt: "asc" } },
            subscriptions: { include: { tier: true, subIndustry: { include: { industry: true } } } }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    for (const membership of memberships) {
      if (!membership.tenant.branches.length) await this.ensureMainBranch(membership.tenantId);
    }

    const refreshed = await this.prisma.tenantUser.findMany({
      where: { userId: user.id },
      include: {
        roleProfile: true,
        branchAccess: { include: { branch: true } },
        tenant: {
          include: {
            branches: { orderBy: { createdAt: "asc" } },
            subscriptions: { include: { tier: true, subIndustry: { include: { industry: true } } } }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return {
      activeTenantId: user.activeTenantId ?? user.tenantId ?? refreshed[0]?.tenantId ?? null,
      activeBranchId: user.activeBranchId ?? refreshed[0]?.tenant.branches[0]?.id ?? null,
      branchScope: user.branchScope ?? "single",
      tenants: refreshed.map((membership) => ({
        id: membership.tenantId,
        name: membership.tenant.name,
        role: membership.role,
        permissions: this.permissionsFor(membership),
        roleProfile: membership.roleProfile,
        branches: membership.tenant.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          status: branch.status,
          address: branch.address,
          phoneNumber: branch.phoneNumber,
          email: branch.email
        })),
        allowedBranchIds: this.branchIdsFor(membership),
        subscriptions: membership.tenant.subscriptions.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          tier: subscription.tier,
          subIndustry: subscription.subIndustry
        }))
      }))
    };
  }

  async listBranches(user: any) {
    const context = await this.requireTenant(user);
    return this.prisma.tenantBranch.findMany({ where: { tenantId: context.tenantId }, orderBy: { createdAt: "asc" } });
  }

  async createBranch(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const branch = await this.prisma.tenantBranch.create({
      data: {
        tenantId: context.tenantId,
        name: this.requiredString(body.name, "Nama cabang wajib diisi."),
        code: this.requiredString(body.code, "Kode cabang wajib diisi.").toUpperCase(),
        status: this.optionalString(body.status) ?? "active",
        address: this.optionalString(body.address),
        phoneNumber: this.optionalString(body.phoneNumber),
        email: this.optionalString(body.email)
      }
    });
    await this.audit(context, "branch.create", "tenant", "TenantBranch", branch.id, null, branch, meta);
    return branch;
  }

  async updateBranch(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const before = await this.prisma.tenantBranch.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Cabang tidak ditemukan.");
    const after = await this.prisma.tenantBranch.update({
      where: { id },
      data: {
        name: this.optionalString(body.name) ?? before.name,
        code: this.optionalString(body.code)?.toUpperCase() ?? before.code,
        status: this.optionalString(body.status) ?? before.status,
        address: this.optionalString(body.address),
        phoneNumber: this.optionalString(body.phoneNumber),
        email: this.optionalString(body.email)
      }
    });
    await this.audit(context, "branch.update", "tenant", "TenantBranch", id, before, after, meta);
    return after;
  }

  async deleteBranch(user: any, id: string, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const branches = await this.prisma.tenantBranch.findMany({ where: { tenantId: context.tenantId } });
    if (branches.length <= 1) throw new BadRequestException("Tenant minimal harus memiliki satu cabang.");
    const before = branches.find((branch) => branch.id === id);
    if (!before) throw new NotFoundException("Cabang tidak ditemukan.");
    await this.prisma.tenantBranch.update({ where: { id }, data: { status: "inactive" } });
    await this.audit(context, "branch.deactivate", "tenant", "TenantBranch", id, before, { status: "inactive" }, meta);
    return { ok: true };
  }

  async listMembers(user: any) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    return this.prisma.tenantUser.findMany({
      where: { tenantId: context.tenantId },
      include: { user: { select: { id: true, name: true, email: true, status: true } }, roleProfile: true, branchAccess: { include: { branch: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  async createMember(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const email = this.requiredString(body.email, "Email member wajib diisi.").toLowerCase();
    const target = await this.prisma.user.findUnique({ where: { email } });
    if (!target) throw new NotFoundException("User dengan email tersebut belum terdaftar.");
    const member = await this.prisma.tenantUser.upsert({
      where: { userId_tenantId: { userId: target.id, tenantId: context.tenantId } },
      update: { role: (this.optionalString(body.role) as any) ?? "employee" },
      create: { userId: target.id, tenantId: context.tenantId, role: (this.optionalString(body.role) as any) ?? "employee" }
    });
    await this.assignBranches(member.id, this.arrayOfStrings(body.branchIds));
    await this.audit(context, "member.upsert", "tenant", "TenantUser", member.id, null, { email, role: member.role }, meta);
    return member;
  }

  async updateMember(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const before = await this.prisma.tenantUser.findFirst({ where: { id, tenantId: context.tenantId }, include: { branchAccess: true } });
    if (!before) throw new NotFoundException("Member tidak ditemukan.");
    const after = await this.prisma.tenantUser.update({
      where: { id },
      data: {
        role: (this.optionalString(body.role) as any) ?? before.role,
        roleProfileId: this.optionalString(body.roleProfileId) ?? before.roleProfileId
      }
    });
    if (Array.isArray(body.branchIds)) await this.assignBranches(id, this.arrayOfStrings(body.branchIds));
    await this.audit(context, "member.update", "tenant", "TenantUser", id, before, after, meta);
    return after;
  }

  async listRoles(user: any) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    await this.ensureSystemRoles(context.tenantId);
    return this.prisma.tenantRoleProfile.findMany({ where: { tenantId: context.tenantId }, orderBy: { createdAt: "asc" } });
  }

  async createRole(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const role = await this.prisma.tenantRoleProfile.create({
      data: {
        tenantId: context.tenantId,
        name: this.requiredString(body.name, "Nama role wajib diisi."),
        slug: this.requiredString(body.slug, "Slug role wajib diisi.").toLowerCase(),
        description: this.optionalString(body.description),
        permissions: this.arrayOfStrings(body.permissions)
      }
    });
    await this.audit(context, "role.create", "tenant", "TenantRoleProfile", role.id, null, role, meta);
    return role;
  }

  async updateRole(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const before = await this.prisma.tenantRoleProfile.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Role tidak ditemukan.");
    const after = await this.prisma.tenantRoleProfile.update({
      where: { id },
      data: {
        name: this.optionalString(body.name) ?? before.name,
        description: this.optionalString(body.description),
        permissions: Array.isArray(body.permissions) ? this.arrayOfStrings(body.permissions) : this.arrayOfStrings(before.permissions)
      }
    });
    await this.audit(context, "role.update", "tenant", "TenantRoleProfile", id, before, after, meta);
    return after;
  }

  async deleteRole(user: any, id: string, meta?: AuditMeta) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    const before = await this.prisma.tenantRoleProfile.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Role tidak ditemukan.");
    if (before.isSystem) throw new BadRequestException("Role sistem tidak bisa dihapus.");
    await this.prisma.tenantRoleProfile.delete({ where: { id } });
    await this.audit(context, "role.delete", "tenant", "TenantRoleProfile", id, before, null, meta);
    return { ok: true };
  }

  async listAuditLogs(user: any, query: Record<string, unknown>) {
    const context = await this.requireTenant(user, ["owner", "admin"]);
    return this.prisma.tenantAuditLog.findMany({
      where: {
        tenantId: context.tenantId,
        ...(this.optionalString(query.action) ? { action: this.optionalString(query.action) } : {}),
        ...(this.optionalString(query.module) ? { module: this.optionalString(query.module) } : {}),
        ...(this.optionalString(query.branchId) ? { branchId: this.optionalString(query.branchId) } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async audit(context: TenantContextLike, action: string, module: string, entityType?: string, entityId?: string | null, before?: unknown, after?: unknown, meta?: AuditMeta) {
    return this.prisma.tenantAuditLog.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? null,
        actorUserId: context.userId ?? null,
        action,
        module,
        entityType,
        entityId: entityId ?? null,
        before: before === undefined ? undefined : (before as any),
        after: after === undefined ? undefined : (after as any),
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 240)
      }
    });
  }

  private async requireTenant(user: any, allowedRoles?: string[]) {
    const tenantId = user.activeTenantId ?? user.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context missing.");
    const membership = await this.prisma.tenantUser.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } });
    if (!membership) throw new ForbiddenException("Anda tidak memiliki akses tenant ini.");
    if (allowedRoles && !allowedRoles.includes(membership.role)) throw new ForbiddenException("Role Anda tidak memiliki akses fitur ini.");
    return { tenantId, branchId: user.activeBranchId ?? null, userId: user.id, role: membership.role };
  }

  private async ensureMainBranch(tenantId: string) {
    return this.prisma.tenantBranch.upsert({
      where: { tenantId_code: { tenantId, code: "MAIN" } },
      update: {},
      create: { tenantId, name: "Main Branch", code: "MAIN", status: "active" }
    });
  }

  private async ensureSystemRoles(tenantId: string) {
    for (const [slug, permissions] of Object.entries(SYSTEM_PERMISSIONS)) {
      await this.prisma.tenantRoleProfile.upsert({
        where: { tenantId_slug: { tenantId, slug } },
        update: { permissions, isSystem: true },
        create: { tenantId, slug, name: this.title(slug), permissions, isSystem: true }
      });
    }
  }

  private async assignBranches(tenantUserId: string, branchIds: string[]) {
    await this.prisma.tenantUserBranch.deleteMany({ where: { tenantUserId } });
    if (!branchIds.length) return;
    await this.prisma.tenantUserBranch.createMany({
      data: branchIds.map((branchId) => ({ tenantUserId, branchId })),
      skipDuplicates: true
    });
  }

  private permissionsFor(membership: any) {
    if (membership.role === "owner") return ["*"];
    const permissions = membership.roleProfile?.permissions;
    return Array.isArray(permissions) ? permissions : SYSTEM_PERMISSIONS[membership.role] ?? [];
  }

  private branchIdsFor(membership: any) {
    if (["owner", "admin"].includes(String(membership.role))) return membership.tenant.branches.map((branch: any) => branch.id);
    const assigned = membership.branchAccess.map((item: any) => item.branchId);
    return assigned.length ? assigned : membership.tenant.branches.slice(0, 1).map((branch: any) => branch.id);
  }

  private requiredString(value: unknown, message: string) {
    const result = this.optionalString(value);
    if (!result) throw new BadRequestException(message);
    return result;
  }

  private optionalString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private arrayOfStrings(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  }

  private title(slug: string) {
    return slug.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
}

type TenantContextLike = {
  tenantId: string;
  branchId?: string | null;
  userId?: string | null;
};

type AuditMeta = {
  ip?: string;
  userAgent?: string;
};
