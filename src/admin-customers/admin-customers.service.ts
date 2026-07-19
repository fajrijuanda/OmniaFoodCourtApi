import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [trialAccounts, subscribedAccounts, pendingTransactions, paidTransactions, followUps] = await Promise.all([
      this.prisma.tenantSubscription.count({ where: { status: "trial" } }),
      this.prisma.tenantSubscription.count({ where: { status: "active" } }),
      this.prisma.billingCheckoutSession.count({ where: { status: "pending" } }),
      this.prisma.billingCheckoutSession.count({ where: { status: "paid" } }),
      this.followUps()
    ]);

    return {
      trialAccounts,
      subscribedAccounts,
      pendingTransactions,
      paidTransactions,
      followUpDue: followUps.length
    };
  }

  async accounts() {
    const users = await this.prisma.user.findMany({
      where: { role: { in: ["owner", "user"] } },
      orderBy: { createdAt: "desc" },
      include: {
        tenantUsers: {
          include: {
            tenant: {
              include: {
                subscriptions: {
                  include: {
                    subIndustry: { include: { industry: true } },
                    tier: true
                  },
                  orderBy: { updatedAt: "desc" }
                }
              }
            }
          }
        }
      }
    });

    return users.map((user) => {
      const tenantUser = user.tenantUsers[0];
      const tenant = tenantUser?.tenant;
      const subscriptions = tenant?.subscriptions ?? [];
      const activeSubscriptions = subscriptions.filter((subscription) => ["active", "trial"].includes(subscription.status));
      const trialSubscription = subscriptions.find((subscription) => subscription.status === "trial");
      const trialEndsAt = trialSubscription?.currentPeriodEnd ?? null;
      const trialExpired = trialEndsAt ? trialEndsAt.getTime() < Date.now() : false;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        subscriptionStatus: trialSubscription ? "trial" : activeSubscriptions.length ? "subscribed" : "unsubscribed",
        effectiveStatus: activeSubscriptions.length ? "subscribed" : "unsubscribed",
        trialStartedAt: trialSubscription?.startedAt ?? null,
        trialEndsAt,
        trialExpired,
        trialSubIndustry: trialSubscription?.subIndustry ? {
          name: trialSubscription.subIndustry.name,
          industry: trialSubscription.subIndustry.industry?.name
        } : null,
        trialTier: trialSubscription?.tier?.name ?? null,
        tenant: tenant ? { id: tenant.id, name: tenant.name, status: tenant.status } : null,
        subscriptions: subscriptions.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          subIndustry: subscription.subIndustry.name,
          industry: subscription.subIndustry.industry?.name,
          tier: subscription.tier.name,
          price: String(subscription.price),
          startedAt: subscription.startedAt,
          currentPeriodEnd: subscription.currentPeriodEnd
        }))
      };
    });
  }

  async transactions() {
    const rows = await this.prisma.billingCheckoutSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: true,
        subIndustry: { include: { industry: true } },
        tier: true
      },
      take: 250
    });

    return rows.map((row) => this.mapTransaction(row));
  }

  async followUps() {
    const now = new Date();
    const inTwoDays = new Date(now.getTime() + 2 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [trialUsers, checkoutRows, renewingSubscriptions] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantUsers: {
            some: {
              tenant: {
                subscriptions: {
                  some: {
                    status: "trial",
                    currentPeriodEnd: { lte: inTwoDays }
                  }
                }
              }
            }
          }
        },
        include: {
          tenantUsers: {
            include: {
              tenant: {
                include: {
                  subscriptions: {
                    where: { status: "trial" },
                    include: { subIndustry: { include: { industry: true } }, tier: true },
                    orderBy: { currentPeriodEnd: "asc" }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      this.prisma.billingCheckoutSession.findMany({
        where: {
          OR: [
            { status: { in: ["pending", "expired", "failed"] } },
            { source: "landing", status: "paid" }
          ],
          followUpStatus: { notIn: ["closed", "converted"] }
        },
        include: { tenant: true, subIndustry: { include: { industry: true } }, tier: true },
        orderBy: { createdAt: "desc" },
        take: 150
      }),
      this.prisma.tenantSubscription.findMany({
        where: {
          status: "active",
          currentPeriodEnd: { gte: sevenDaysAgo, lte: inTwoDays }
        },
        include: {
          tenant: { include: { tenantUsers: { include: { user: true } } } },
          subIndustry: { include: { industry: true } },
          tier: true
        },
        orderBy: { currentPeriodEnd: "asc" },
        take: 100
      })
    ]);

    return [
      ...trialUsers.map((user) => {
        const trialSubscription = user.tenantUsers[0]?.tenant?.subscriptions?.[0];
        return {
          id: `trial-${user.id}`,
          type: "trial",
          priority: trialSubscription?.currentPeriodEnd && trialSubscription.currentPeriodEnd.getTime() < now.getTime() ? "high" : "medium",
          customerName: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          context: `${trialSubscription?.subIndustry?.industry?.name ?? "Trial"} / ${trialSubscription?.subIndustry?.name ?? "-"} / ${trialSubscription?.tier?.name ?? "-"}`,
          status: trialSubscription?.currentPeriodEnd && trialSubscription.currentPeriodEnd.getTime() < now.getTime() ? "Trial expired" : "Trial hampir selesai",
          amount: null,
          dueAt: trialSubscription?.currentPeriodEnd ?? null,
          notes: "Follow-up agar customer lanjut berlangganan."
        };
      }),
      ...checkoutRows.map((row) => ({
        id: row.id,
        type: row.source === "landing" ? "landing_checkout" : "portal_checkout",
        priority: row.status === "paid" ? "medium" : "high",
        customerName: row.customerName ?? row.tenant?.name ?? "Lead tanpa nama",
        email: row.customerEmail,
        phoneNumber: row.customerPhone,
        context: `${row.action} ${row.subIndustry?.name ?? "multi app"} ${row.tier?.name ?? ""}`.trim(),
        status: row.status,
        amount: String(row.total),
        dueAt: row.createdAt,
        notes: row.followUpNotes ?? (row.status === "paid" ? "Konfirmasi onboarding dan aktivasi." : "Checkout belum selesai, hubungi customer.")
      })),
      ...renewingSubscriptions.map((subscription) => {
        const owner = subscription.tenant.tenantUsers.find((tenantUser) => tenantUser.role === "owner")?.user ?? subscription.tenant.tenantUsers[0]?.user;
        return {
          id: `renew-${subscription.id}`,
          type: "renewal",
          priority: subscription.currentPeriodEnd.getTime() < now.getTime() ? "high" : "medium",
          customerName: owner?.name ?? subscription.tenant.name,
          email: owner?.email ?? null,
          phoneNumber: owner?.phoneNumber ?? null,
          context: `${subscription.subIndustry.industry?.name ?? "-"} / ${subscription.subIndustry.name} / ${subscription.tier.name}`,
          status: subscription.currentPeriodEnd.getTime() < now.getTime() ? "Expired renewal" : "Renewal dekat",
          amount: String(subscription.price),
          dueAt: subscription.currentPeriodEnd,
          notes: "Follow-up perpanjangan langganan."
        };
      })
    ].sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 } as Record<string, number>;
      return (priority[a.priority] ?? 2) - (priority[b.priority] ?? 2);
    });
  }

  async updateFollowUp(id: string, data: { followUpStatus?: string; followUpNotes?: string }) {
    return this.prisma.billingCheckoutSession.update({
      where: { id },
      data: {
        followUpStatus: data.followUpStatus ?? undefined,
        followUpNotes: data.followUpNotes ?? undefined,
        lastFollowedUpAt: new Date()
      }
    });
  }

  private mapTransaction(row: any) {
    return {
      id: row.id,
      externalId: row.externalId,
      provider: row.provider,
      providerInvoiceId: row.providerInvoiceId,
      checkoutUrl: row.checkoutUrl,
      source: row.source,
      action: row.action,
      status: row.status,
      paymentMethod: row.paymentMethod,
      customerName: row.customerName ?? row.tenant?.name ?? null,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      tenant: row.tenant ? { id: row.tenant.id, name: row.tenant.name } : null,
      industry: row.subIndustry?.industry?.name ?? null,
      subIndustry: row.subIndustry?.name ?? null,
      tier: row.tier?.name ?? null,
      items: row.itemsJson,
      subtotal: String(row.subtotal),
      tax: String(row.tax),
      gatewayFee: String(row.gatewayFee),
      total: String(row.total),
      followUpStatus: row.followUpStatus,
      followUpNotes: row.followUpNotes,
      paidAt: row.paidAt,
      createdAt: row.createdAt
    };
  }
}
