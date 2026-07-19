import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CheckoutService } from "../checkout/checkout.service";

export type BillingTierName = "starter" | "growth" | "pro" | "enterprise";
export type PaymentMethod = "card" | "qris" | "bank_transfer";

const tierOrder: Record<BillingTierName, number> = {
  starter: 0,
  growth: 1,
  pro: 2,
  enterprise: 3
};

const tierDurationDays: Record<BillingTierName, number> = {
  starter: 30,
  growth: 30,
  pro: 30,
  enterprise: 365
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly checkout: CheckoutService) {}

  async getSummary(user: any) {
    if (user.role === "super_admin") {
      return this.virtualEnterpriseSummary();
    }

    const tenantId = this.getTenantId(user);
    const subscription = await this.findPrimarySubscription(tenantId);
    if (!subscription) {
      return {
        status: "unsubscribed",
        tier: "starter",
        tierName: "Starter",
        planDurationDays: 0,
        remainingDays: 0,
        startedAt: null,
        currentPeriodEnd: null,
        price: "0",
        paymentMethod: null,
        invoices: []
      };
    }

    return this.toSummary(subscription);
  }

  async upgradeTier(user: any, tier: BillingTierName) {
    if (user.role === "super_admin") {
      return this.virtualEnterpriseSummary();
    }

    const tenantId = this.getTenantId(user);
    const branchId = this.getBranchId(user);
    const current = await this.findPrimarySubscription(tenantId);
    if (!current) throw new NotFoundException("Subscription tenant belum tersedia.");

    const nextTier = await this.findHrisTier(tier);
    const startedAt = new Date();
    const currentPeriodEnd = this.addDays(startedAt, tierDurationDays[tier]);

    const updated = await this.prisma.tenantSubscription.update({
      where: { id: current.id },
      data: {
        tierId: nextTier.id,
        subIndustryId: nextTier.subIndustryId,
        branchId,
        createdByUserId: user?.id ?? null,
        status: "active",
        startedAt,
        currentPeriodEnd,
        price: this.extractPriceNumber(nextTier.price)
      },
      include: { tier: { include: { subIndustry: true } }, subIndustry: true }
    });

    return this.toSummary(updated, `UPG-${Date.now()}`);
  }

  async createPaymentIntent(user: any, body: { tier: BillingTierName; method: PaymentMethod; providerReference?: string }) {
    if (user.role === "super_admin") {
      throw new ForbiddenException("Superadmin tidak membutuhkan payment.");
    }

    const tier = await this.findHrisTier(body.tier);
    const paymentId = `pay_${Date.now()}`;
    return {
      paymentId,
      status: "requires_confirmation",
      method: body.method,
      tier: body.tier,
      amount: tier.price,
      currency: "IDR",
      providerReference: body.providerReference ?? null,
      checkoutUrl: `/portal/billing?payment=${paymentId}`
    };
  }

  async createCheckout(user: any, body: {
    checkoutType: "add_app" | "upgrade" | "renew";
    method: PaymentMethod;
    industryName: string;
    segmentName: string;
    tierName: string;
    amount?: number;
  }) {
    if (user.role === "super_admin") {
      throw new ForbiddenException("Superadmin tidak membutuhkan payment.");
    }

    const tenantId = this.getTenantId(user);
    const branchId = this.getBranchId(user);
    const tier = await this.findTierForCheckout(body.segmentName, body.tierName);
    const amount = this.extractPriceNumber(tier.price) || body.amount || 0;
    const checkoutItems = [{
      itemType: "subscription" as const,
      industryName: tier.subIndustry.industry?.name ?? body.industryName,
      segmentName: tier.subIndustry.name,
      tierName: tier.name,
      amount
    }];
    const checkout = await this.checkout.createCheckout({
      source: "portal",
      checkoutType: body.checkoutType,
      method: body.method,
      items: checkoutItems
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId,
        branchId,
        createdByUserId: user?.id ?? null,
        subIndustryId: tier.subIndustryId,
        tierId: tier.id,
        externalId: checkout.checkoutId,
        providerInvoiceId: checkout.invoiceId,
        checkoutUrl: checkout.checkoutUrl,
        source: "portal",
        action: body.checkoutType,
        paymentMethod: body.method,
        customerName: user?.name ?? null,
        customerEmail: user?.email ?? null,
        customerPhone: user?.phoneNumber ?? null,
        itemsJson: checkoutItems,
        subtotal: checkout.subtotal,
        tax: checkout.tax,
        gatewayFee: checkout.gatewayFee,
        total: checkout.total,
        status: "pending"
      }
    });

    return checkout;
  }

  async listAddOns(user: any) {
    const tenantId = user.role === "super_admin" ? null : this.getTenantId(user);
    const branchId = user.role === "super_admin" ? null : this.getBranchId(user);
    const [catalog, activeAddOns] = await Promise.all([
      this.prisma.addOn.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      tenantId
        ? this.prisma.tenantAddOn.findMany({
            where: {
              tenantId,
              status: "active",
              OR: [{ branchId }, { branchId: null }]
            },
            include: { addOn: true },
            orderBy: { updatedAt: "desc" }
          })
        : Promise.resolve([])
    ]);
    const activeSlugs = new Set(activeAddOns.map((item) => item.addOn.slug));

    return catalog.map((addOn) => ({
      id: addOn.id,
      slug: addOn.slug,
      name: addOn.name,
      category: addOn.category,
      complexity: addOn.complexity,
      price: addOn.price,
      amount: Number(addOn.amount),
      cadence: addOn.cadence,
      description: addOn.description,
      bestFor: addOn.bestFor,
      recommendedFor: addOn.recommendedFor,
      sourceApp: addOn.sourceApp,
      active: activeSlugs.has(addOn.slug)
    }));
  }

  async createAddOnCheckout(user: any, body: { addOnId: string; method: PaymentMethod }) {
    if (user.role === "super_admin") {
      throw new ForbiddenException("Superadmin tidak membutuhkan payment.");
    }

    const tenantId = this.getTenantId(user);
    const branchId = this.getBranchId(user);
    const addOn = await this.prisma.addOn.findFirst({
      where: {
        isActive: true,
        OR: [{ id: body.addOnId }, { slug: body.addOnId }]
      }
    });
    if (!addOn) throw new NotFoundException("Add-on belum tersedia.");

    const amount = Number(addOn.amount);
    const checkoutItems = [{
      itemType: "addon" as const,
      addOnId: addOn.slug,
      industryName: "Omnia Add-on",
      segmentName: addOn.category,
      tierName: addOn.name,
      amount
    }];
    const checkout = await this.checkout.createCheckout({
      source: "portal",
      checkoutType: "add_app",
      method: body.method,
      items: checkoutItems
    });

    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId,
        branchId,
        createdByUserId: user?.id ?? null,
        externalId: checkout.checkoutId,
        providerInvoiceId: checkout.invoiceId,
        checkoutUrl: checkout.checkoutUrl,
        source: "portal",
        action: "add_app",
        paymentMethod: body.method,
        customerName: user?.name ?? null,
        customerEmail: user?.email ?? null,
        customerPhone: user?.phoneNumber ?? null,
        itemsJson: checkoutItems,
        subtotal: checkout.subtotal,
        tax: checkout.tax,
        gatewayFee: checkout.gatewayFee,
        total: checkout.total,
        status: "pending"
      }
    });

    return checkout;
  }

  async confirmPayment(user: any, paymentId: string) {
    if (user.role === "super_admin") {
      return { paymentId, status: "paid", summary: this.virtualEnterpriseSummary() };
    }

    const summary = await this.getSummary(user);
    return { paymentId, status: "paid", summary };
  }

  private getTenantId(user: any) {
    if (user?.tenantId) return user.tenantId as string;
    const tenantUser = user?.tenantUsers?.[0];
    if (!tenantUser?.tenantId) {
      throw new ForbiddenException("User belum terhubung ke tenant.");
    }
    return tenantUser.tenantId as string;
  }

  private getBranchId(user: any) {
    return user?.activeBranchId ?? user?.branchId ?? null;
  }

  private findPrimarySubscription(tenantId: string) {
    return this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      include: { tier: { include: { subIndustry: true } }, subIndustry: true }
    });
  }

  private async findHrisTier(tier: BillingTierName) {
    const tierName = tier[0].toUpperCase() + tier.slice(1);
    const found = await this.prisma.tier.findFirst({
      where: {
        name: { contains: tierName },
        subIndustry: { name: "HRIS" },
        isActive: true
      },
      include: { subIndustry: true },
      orderBy: { sortOrder: "asc" }
    });
    if (!found) throw new NotFoundException(`Tier HRIS ${tierName} belum tersedia.`);
    return found;
  }

  private async findTierForCheckout(segmentName: string, tierName: string) {
    const exact = await this.prisma.tier.findFirst({
      where: {
        name: { equals: tierName, mode: "insensitive" },
        isActive: true,
        subIndustry: {
          OR: [
            { name: segmentName },
            { name: { contains: segmentName, mode: "insensitive" } },
            { slug: { contains: segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mode: "insensitive" } }
          ]
        }
      },
      include: { subIndustry: { include: { industry: true } } }
    });
    if (exact) return exact;

    const tierLabel = this.parseTier(tierName);
    const label = this.tierLabel(tierLabel);
    const found = await this.prisma.tier.findFirst({
      where: {
        name: { contains: label, mode: "insensitive" },
        isActive: true,
        subIndustry: {
          OR: [
            { name: segmentName },
            { name: { contains: segmentName, mode: "insensitive" } },
            { slug: { contains: segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mode: "insensitive" } }
          ]
        }
      },
      include: { subIndustry: { include: { industry: true } } },
      orderBy: { sortOrder: "asc" }
    });
    if (!found) throw new NotFoundException(`Tier ${label} untuk ${segmentName} belum tersedia.`);
    return found;
  }

  private toSummary(subscription: any, invoiceNumber?: string) {
    const tier = this.parseTier(subscription.tier?.name ?? subscription.tier?.slug ?? "growth");
    const startedAt = new Date(subscription.startedAt);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const planDurationDays = Math.max(0, Math.ceil((periodEnd.getTime() - startedAt.getTime()) / 86400000));
    const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000));

    return {
      status: subscription.status,
      tier,
      tierName: this.tierLabel(tier),
      subIndustry: subscription.subIndustry?.name ?? subscription.tier?.subIndustry?.name ?? "HRIS",
      planDurationDays,
      remainingDays,
      startedAt: startedAt.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      price: String(subscription.price ?? subscription.tier?.price ?? "0"),
      paymentMethod: "card",
      invoices: [
        {
          id: invoiceNumber ?? `INV-${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}`,
          period: periodEnd.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
          amount: subscription.tier?.price ?? String(subscription.price ?? "0"),
          status: subscription.status === "past_due" ? "Unpaid" : "Paid"
        }
      ]
    };
  }

  private virtualEnterpriseSummary() {
    const startedAt = new Date();
    const currentPeriodEnd = this.addDays(startedAt, 365);
    return {
      status: "active",
      tier: "enterprise",
      tierName: "Enterprise",
      subIndustry: "All sub-industri",
      planDurationDays: 365,
      remainingDays: 365,
      startedAt: startedAt.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      price: "Internal access",
      paymentMethod: "internal",
      invoices: []
    };
  }

  private parseTier(value: string): BillingTierName {
    const normalized = value.toLowerCase();
    if (normalized.includes("enterprise")) return "enterprise";
    if (normalized.includes("pro")) return "pro";
    if (normalized.includes("growth")) return "growth";
    return "starter";
  }

  private tierLabel(tier: BillingTierName) {
    return tier[0].toUpperCase() + tier.slice(1);
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 86400000);
  }

  private extractPriceNumber(price: string) {
    const normalized = price.toLowerCase().replace(/\s+/g, "");
    const match = normalized.match(/([0-9,.]+)(rb|jt)/);
    if (match) {
      const amount = Number(match[1].replace(",", "."));
      if (Number.isFinite(amount)) return Math.round(amount * (match[2] === "jt" ? 1000000 : 1000));
    }
    const rupiahMatch = normalized.match(/rp([0-9.]+)/);
    if (rupiahMatch) {
      const amount = Number(rupiahMatch[1].replace(/\./g, ""));
      if (Number.isFinite(amount)) return amount;
    }
    const numeric = normalized.replace(/[^\d]/g, "");
    return numeric ? Number(numeric) : tierOrder[price.toLowerCase() as BillingTierName] ?? 0;
  }
}
