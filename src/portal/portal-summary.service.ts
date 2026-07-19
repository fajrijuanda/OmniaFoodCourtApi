import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const rupiah = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;
const socialCommerceSegment = {
  name: "Social Commerce Intelligence",
  slug: "e-commerce-marketplace-social-commerce-intelligence",
  need: "Sinyal produk, creator, live, ads, dan kompetitor tersebar di banyak marketplace.",
  offer: "Product radar, creator signal, competitor watchlist, connector status, alert center, action cards."
};

@Injectable()
export class PortalSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: any) {
    const tenantId = await this.resolveTenantId(user);
    const [subscriptions, employees, notifications, totalTenants, globalSubscriptions, totalUsers] = await Promise.all([
      this.prisma.tenantSubscription.findMany({
        where: { tenantId },
        include: { tier: true, subIndustry: { include: { industry: true } } },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.employee.count({ where: { tenantId, status: "active" } }),
      this.prisma.notification.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8 }),
      this.prisma.tenant.count(),
      this.prisma.tenantSubscription.count({ where: { status: { in: ["active", "trial"] } } }),
      this.prisma.user.count()
    ]);

    const unlockedApps = subscriptions.map((subscription) => ({
      name: subscription.subIndustry.name,
      category: subscription.subIndustry.industry?.name ?? "Industry",
      badge: subscription.tier?.name?.split(" ").slice(-1)[0] ?? subscription.status,
      path: `/portal/${subscription.subIndustry.industry?.slug ?? "apps"}/${subscription.subIndustry.slug}`
    }));

    const mrrEstimation = globalSubscriptions * 250000;

    return {
      reports: [
        { value: String(totalTenants), label: "Total Tenant", caption: "terdaftar di portal" },
        { value: String(globalSubscriptions), label: "Active Subscriptions", caption: "lintas industri" },
        { value: rupiah(mrrEstimation), label: "Estimasi MRR", caption: "Monthly recurring revenue" },
        { value: String(totalUsers), label: "Total Users", caption: "akun aktif portal" }
      ],
      quickAccess: unlockedApps,
      activity: notifications.map((notification) => notification.title),
      reportCharts: this.getReportCharts(),
      hrisModules: await this.getHrisModules(),
      access: {
        employees,
        activeSubscriptions: subscriptions.filter((subscription) => ["active", "trial"].includes(subscription.status)).length
      }
    };
  }

  async getCatalog(user: any) {
    const isOmniaMember = user?.role === "super_admin" || user?.tenantUsers?.some((tu: any) => tu.tenantId === "pt-omnia-internal" || tu.tenant?.id === "pt-omnia-internal");
    const industries = await this.prisma.industry.findMany({
      where: { 
        isActive: true,
        ...(isOmniaMember ? {} : { name: { not: "Internal Operations" } })
      },
      orderBy: { sortOrder: "asc" },
      include: { subIndustries: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } }
    });

    return this.withSocialCommerceSegment(industries);
  }

  private withSocialCommerceSegment<T extends { id: string; slug: string; subIndustries: any[] }>(industries: T[]) {
    return industries.map((industry) => {
      const isCommerceIndustry = industry.slug.includes("commerce") || industry.slug.includes("marketplace");
      const hasSocialCommerce = industry.subIndustries.some((subIndustry) => subIndustry.slug.includes("social-commerce-intelligence") || subIndustry.name === socialCommerceSegment.name);
      if (!isCommerceIndustry || hasSocialCommerce) return industry;

      return {
        ...industry,
        subIndustries: [
          ...industry.subIndustries,
          {
            id: socialCommerceSegment.slug,
            industryId: industry.id,
            ...socialCommerceSegment,
            sortOrder: industry.subIndustries.length,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };
    });
  }

  private async resolveTenantId(user: any) {
    const tenantId = user?.tenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.tenantUsers?.[0]?.tenant?.id;
    if (tenantId) return tenantId;

    if (user?.role === "super_admin") {
      const demoTenant = await this.prisma.tenant.findFirst({ where: { id: "demo-tenant-omnia" } });
      if (demoTenant) return demoTenant.id;
    }

    throw new NotFoundException("Tenant context belum tersedia.");
  }

  private startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getReportCharts() {
    // Generate mock portal analytics charts
    const tenantGrowth = [12, 18, 25, 34, 48, 65, 82];
    const revenueGrowth = [1500, 2200, 3100, 4500, 5800, 7200, 9500];
    const industryAdoption = [85, 42, 67, 23, 11]; // e.g. HRIS, F&B, Clinic, dll

    return [
      { title: "Pertumbuhan Tenant Baru", values: tenantGrowth },
      { title: "MRR Growth (in M)", values: revenueGrowth },
      { title: "Top Sub-Industri Paling Laris", values: industryAdoption }
    ];
  }

  private async getHrisModules() {
    const hris = await this.prisma.subIndustry.findFirst({
      where: { name: "HRIS" },
      include: { features: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: 8 } }
    });

    return (hris?.features ?? []).map((feature, index) => ({
      name: feature.name,
      caption: feature.description ?? "Module catalog",
      active: index < 5
    }));
  }
}
