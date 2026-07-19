import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortalSettings(user: any) {
    const tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.tenantUsers?.[0]?.tenant?.id;
    const tenant = tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          include: {
            subscriptions: {
              include: {
                tier: {
                  include: {
                    subIndustry: {
                      include: { industry: true }
                    }
                  }
                }
              }
            },
            tenantUsers: {
              include: { user: true }
            }
          }
        })
      : null;

    const activeSubscription = tenant?.subscriptions[0];

    return {
      tenant: {
        id: tenant?.id ?? "demo-tenant",
        name: tenant?.name ?? "Omnia HRIS",
        status: tenant?.status ?? "active",
        domain: "demo-hris.omnia.co.id",
        timezone: "Asia/Jakarta",
        language: "Indonesia"
      },
      subscription: activeSubscription
        ? {
            status: activeSubscription.status,
            tier: activeSubscription.tier.name,
            subIndustry: activeSubscription.tier.subIndustry.name,
            industry: activeSubscription.tier.subIndustry.industry.name,
            currentPeriodEnd: activeSubscription.currentPeriodEnd,
            price: Number(activeSubscription.price)
          }
        : {
            status: "demo",
            tier: "Enterprise",
            subIndustry: "HRIS",
            industry: "Jasa Profesional",
            currentPeriodEnd: null,
            price: 0
          },
      access: {
        users: tenant?.tenantUsers.length ?? 3,
        owners: tenant?.tenantUsers.filter((item) => item.role === "owner").length ?? 1,
        admins: tenant?.tenantUsers.filter((item) => item.role === "admin").length ?? 1,
        employees: tenant?.tenantUsers.filter((item) => item.role === "employee").length ?? 1
      },
      security: {
        sessionTimeoutMinutes: 60,
        enforceSso: false,
        loginAudit: true,
        deviceLimit: 3
      },
      notifications: {
        payrollEmail: true,
        leaveApprovalEmail: true,
        billingReminder: true,
        weeklyDigest: true
      }
    };
  }

  async updatePortalSettings(user: any, body: any) {
    const tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.tenantUsers?.[0]?.tenant?.id;
    if (tenantId && typeof body?.tenant?.name === "string") {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { name: body.tenant.name }
      });
    }

    return {
      ...(await this.getPortalSettings(user)),
      updated: true
    };
  }
}
