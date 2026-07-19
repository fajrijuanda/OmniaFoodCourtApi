import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  tokenVersion?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret && process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is missing in production environment");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: secret ?? "dev-secret"
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: payload.sub },
          ...(payload.email ? [{ email: payload.email.toLowerCase() }] : [])
        ]
      },
      include: {
        tenantUsers: {
          include: {
            roleProfile: true,
            branchAccess: { include: { branch: true } },
            tenant: {
              include: {
                branches: { orderBy: { createdAt: "asc" } },
                subscriptions: {
                  include: {
                    tier: {
                      include: {
                        subIndustry: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user || user.status !== "active" || (user.id === payload.sub && payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion)) {
      throw new UnauthorizedException();
    }

    const requestedTenantId = this.firstHeader(request, "x-tenant-id");
    const requestedBranchId = this.firstHeader(request, "x-branch-id");
    const requestedBranchScope = this.firstHeader(request, "x-branch-scope");
    const tenantUser = this.resolveTenantUser(user, requestedTenantId);
    if (!tenantUser && !["super_admin", "admin"].includes(user.role)) throw new UnauthorizedException("Tenant context tidak valid.");

    const defaultBranch = tenantUser ? await this.ensureMainBranch(tenantUser.tenantId) : null;
    const branchScope = requestedBranchScope === "all" && this.canUseAllBranches(tenantUser)
      ? "all"
      : "single";
    const activeBranchId = branchScope === "all"
      ? null
      : this.resolveBranchId(tenantUser, requestedBranchId, defaultBranch?.id ?? null);

    return {
      ...user,
      tenantId: tenantUser?.tenantId ?? tenantUser?.tenant?.id ?? null,
      activeTenantId: tenantUser?.tenantId ?? tenantUser?.tenant?.id ?? null,
      tenantRole: tenantUser?.role ?? null,
      roleProfile: tenantUser?.roleProfile ?? null,
      permissions: this.permissionsFor(tenantUser),
      employeeId: await this.employeeIdFor(user.id, user.email, tenantUser?.tenantId ?? tenantUser?.tenant?.id),
      branchId: activeBranchId,
      activeBranchId,
      branchScope,
      branchIds: tenantUser ? this.branchIdsFor(tenantUser) : []
    };
  }

  private resolveTenantUser(user: any, requestedTenantId?: string | null) {
    if (!user.tenantUsers?.length) return null;
    if (requestedTenantId) {
      const matchingTenant = user.tenantUsers.find((item: any) => item.tenantId === requestedTenantId || item.tenant?.id === requestedTenantId);
      if (matchingTenant) return matchingTenant;
      if (user.tenantUsers.length === 1 || ["super_admin", "admin"].includes(user.role)) return user.tenantUsers[0];
      return null;
    }
    return user.tenantUsers[0];
  }

  private resolveBranchId(tenantUser: any, requestedBranchId?: string | null, defaultBranchId?: string | null) {
    if (!tenantUser) return null;
    const allBranchIds = tenantUser.tenant?.branches?.map((branch: any) => branch.id) ?? [];
    const allowedBranchIds = this.branchIdsFor(tenantUser);
    const canUseAnyBranch = ["owner", "admin"].includes(String(tenantUser.role));
    if (requestedBranchId && (canUseAnyBranch ? allBranchIds.includes(requestedBranchId) : allowedBranchIds.includes(requestedBranchId))) {
      return requestedBranchId;
    }
    if (allowedBranchIds[0]) return allowedBranchIds[0];
    return defaultBranchId ?? allBranchIds[0] ?? null;
  }

  private branchIdsFor(tenantUser: any) {
    const branches = tenantUser.tenant?.branches ?? [];
    if (["owner", "admin"].includes(String(tenantUser.role))) {
      return branches.map((branch: any) => branch.id);
    }
    const assigned = tenantUser.branchAccess?.map((item: any) => item.branchId ?? item.branch?.id).filter(Boolean) ?? [];
    return assigned.length ? assigned : branches.slice(0, 1).map((branch: any) => branch.id);
  }

  private canUseAllBranches(tenantUser: any) {
    if (!["owner", "admin"].includes(String(tenantUser?.role))) return false;
    const subscriptions = tenantUser?.tenant?.subscriptions ?? [];
    return subscriptions.some((subscription: any) => {
      const tierText = `${subscription.tier?.slug ?? ""} ${subscription.tier?.name ?? ""}`.toLowerCase();
      return tierText.includes("growth") || tierText.includes("pro") || tierText.includes("business") || tierText.includes("enterprise");
    });
  }

  private permissionsFor(tenantUser: any) {
    if (!tenantUser) return [];
    if (tenantUser.role === "owner") return ["*"];
    const permissions = tenantUser.roleProfile?.permissions;
    if (Array.isArray(permissions)) return permissions;
    if (tenantUser.role === "admin") return ["tenant.manage", "branch.manage", "member.manage", "role.manage", "audit.read", "billing.manage", "clinic.*", "hris.*"];
    if (tenantUser.role === "employee") return ["portal.read", "hris.self.read", "hris.self.write", "hris.loan.request"];
    return [];
  }

  private async employeeIdFor(userId: string, email: string | null | undefined, tenantId?: string | null) {
    if (!tenantId) return null;
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { userId },
          ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
      },
      select: { id: true }
    });
    return employee?.id ?? null;
  }

  private firstHeader(request: Request, name: string) {
    const value = request.headers[name] ?? request.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private async ensureMainBranch(tenantId: string) {
    const existing = await this.prisma.tenantBranch.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    return this.prisma.tenantBranch.create({
      data: { tenantId, name: "Main Branch", code: "MAIN", status: "active" }
    });
  }
}
