import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

export type CheckoutPaymentMethod = "qris" | "bank_transfer" | "card";

type CheckoutItemInput = {
  itemType?: "subscription" | "addon";
  addOnId?: string;
  industryName: string;
  segmentName: string;
  tierName: string;
  amount: number;
};

type NormalizedCheckoutItem = {
  itemType: "subscription" | "addon";
  addOnId: string | null;
  industryName: string;
  segmentName: string;
  tierName: string;
  amount: number;
};

type CheckoutCustomerInput = {
  name?: string;
  email?: string;
  phone?: string;
};

type CheckoutInput = {
  items: CheckoutItemInput[];
  method?: CheckoutPaymentMethod;
  customer?: CheckoutCustomerInput;
  source?: "landing" | "portal";
  checkoutType?: "new_subscription" | "add_app" | "upgrade" | "renew";
};

const qrisFeeRate = 0.0063;
const bankTransferFee = 4000;
const cardFeeRate = 0.029;
const cardFixedFee = 2000;
const ppnRate = 0.11;

const xenditPaymentMethods: Record<CheckoutPaymentMethod, string[]> = {
  qris: ["QRIS"],
  bank_transfer: ["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "BSI"],
  card: ["CREDIT_CARD"]
};

@Injectable()
export class CheckoutService {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async createCheckout(input: CheckoutInput) {
    if (!input.items?.length) {
      throw new BadRequestException("Pilih minimal satu aplikasi sebelum checkout.");
    }

    const method = input.method ?? "qris";
    const normalizedItems = input.items.map((item) => this.normalizeItem(item));
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
    const tax = Math.ceil(subtotal * ppnRate);
    const payableBeforeGatewayFee = subtotal + tax;
    const gatewayFee = this.calculateGatewayFee(payableBeforeGatewayFee, method);
    const total = payableBeforeGatewayFee + gatewayFee;
    const externalId = `omnia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const checkoutSummary = {
      provider: "xendit",
      method,
      currency: "IDR",
      subtotal,
      tax,
      gatewayFee,
      total,
      feePolicy: "Gateway fee dibebankan ke customer."
    };

    const secretKey = this.config.get<string>("XENDIT_SECRET_KEY");
    if (!secretKey) {
      throw new ServiceUnavailableException({
        message: "XENDIT_SECRET_KEY belum dikonfigurasi di API deploy.",
        checkout: checkoutSummary
      });
    }

    const invoice = await this.createXenditInvoice({
      secretKey,
      externalId,
      method,
      customer: input.customer,
      items: normalizedItems,
      source: input.source ?? "landing",
      checkoutType: input.checkoutType ?? "new_subscription",
      subtotal,
      tax,
      gatewayFee,
      total
    });

    if ((input.source ?? "landing") === "landing") {
      await this.recordPublicCheckoutSession({
        checkoutId: externalId,
        invoice,
        method,
        checkoutType: input.checkoutType ?? "new_subscription",
        customer: input.customer,
        items: normalizedItems,
        subtotal,
        tax,
        gatewayFee,
        total
      });
    }

    return {
      checkoutId: externalId,
      checkoutUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      status: invoice.status,
      ...checkoutSummary
    };
  }

  private async recordPublicCheckoutSession({
    checkoutId,
    invoice,
    method,
    checkoutType,
    customer,
    items,
    subtotal,
    tax,
    gatewayFee,
    total
  }: {
    checkoutId: string;
    invoice: { id: string; invoice_url: string; status: string };
    method: CheckoutPaymentMethod;
    checkoutType: "new_subscription" | "add_app" | "upgrade" | "renew";
    customer?: CheckoutCustomerInput;
    items: NormalizedCheckoutItem[];
    subtotal: number;
    tax: number;
    gatewayFee: number;
    total: number;
  }) {
    const firstItem = items.find((item) => item.itemType !== "addon");
    const tier = firstItem ? await this.findTierByCheckoutItem(firstItem).catch(() => null) : null;
    await this.prisma.billingCheckoutSession.create({
      data: {
        tenantId: null,
        subIndustryId: tier?.subIndustryId ?? null,
        tierId: tier?.id ?? null,
        externalId: checkoutId,
        providerInvoiceId: invoice.id,
        checkoutUrl: invoice.invoice_url,
        source: "landing",
        action: checkoutType,
        paymentMethod: method,
        customerName: customer?.name ?? null,
        customerEmail: customer?.email ?? null,
        customerPhone: customer?.phone ?? null,
        itemsJson: items,
        subtotal,
        tax,
        gatewayFee,
        total,
        status: "pending",
        followUpStatus: "new"
      }
    });
  }

  private async findTierByCheckoutItem(item: NormalizedCheckoutItem) {
    if (item.itemType === "addon") return null;

    const exact = await this.prisma.tier.findFirst({
      where: {
        isActive: true,
        name: { equals: item.tierName, mode: "insensitive" },
        subIndustry: {
          OR: [
            { name: item.segmentName },
            { name: { contains: item.segmentName, mode: "insensitive" } },
            { slug: { contains: item.segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mode: "insensitive" } }
          ]
        }
      }
    });
    if (exact) return exact;

    const tierLabel = item.tierName.toLowerCase().includes("enterprise")
      ? "Enterprise"
      : item.tierName.toLowerCase().includes("pro")
        ? "Pro"
        : item.tierName.toLowerCase().includes("growth")
          ? "Growth"
          : "Starter";

    return this.prisma.tier.findFirst({
      where: {
        isActive: true,
        name: { contains: tierLabel, mode: "insensitive" },
        subIndustry: {
          OR: [
            { name: item.segmentName },
            { name: { contains: item.segmentName, mode: "insensitive" } },
            { slug: { contains: item.segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mode: "insensitive" } }
          ]
        }
      }
    });
  }

  async handleXenditWebhook(headers: Record<string, any>, payload: any) {
    const expectedToken = this.config.get<string>("XENDIT_CALLBACK_TOKEN");
    if (expectedToken && headers["x-callback-token"] !== expectedToken) {
      throw new ForbiddenException("Xendit callback token tidak valid.");
    }

    const externalId = payload?.external_id;
    if (!externalId) {
      throw new BadRequestException("Payload Xendit tidak memiliki external_id.");
    }

    const status = String(payload?.status ?? "").toUpperCase();
    const session = await this.prisma.billingCheckoutSession.findUnique({
      where: { externalId },
      include: { tier: true, subIndustry: true }
    });

    if (!session) {
      return { received: true, matched: false };
    }

    if (["PAID", "SETTLED"].includes(status)) {
      await this.activateBillingSession(session.id, payload?.id ?? null);
      return { received: true, matched: true, status: "paid" };
    }

    if (["EXPIRED", "FAILED"].includes(status)) {
      await this.prisma.billingCheckoutSession.update({
        where: { id: session.id },
        data: { status: status.toLowerCase(), providerInvoiceId: payload?.id ?? session.providerInvoiceId }
      });
      return { received: true, matched: true, status: status.toLowerCase() };
    }

    return { received: true, matched: true, status: session.status };
  }

  private async activateBillingSession(sessionId: string, providerInvoiceId?: string | null) {
    const session = await this.prisma.billingCheckoutSession.findUnique({
      where: { id: sessionId },
      include: { tier: true }
    });
    if (!session || session.status === "paid") return;

    const addOnItems = this.getAddOnItems(session.itemsJson);
    if (!session.tenantId) {
      await this.markSessionPaid(session.id, {
        providerInvoiceId: providerInvoiceId ?? session.providerInvoiceId,
        followUpStatus: "paid_lead"
      });
      return;
    }

    const tenantId = session.tenantId;
    const now = new Date();
    const hasSubscriptionLine = Boolean(session.subIndustryId && session.tierId && session.tier);
    const currentPeriodEnd = hasSubscriptionLine
      ? new Date(now.getTime() + this.getPlanDurationDays(session.tier!.name) * 86400000)
      : new Date(now.getTime() + 30 * 86400000);

    await this.prisma.$transaction(async (tx) => {
      if (hasSubscriptionLine) {
        const subIndustryId = session.subIndustryId!;
        const tierId = session.tierId!;
        const currentSubscription = await tx.tenantSubscription.findFirst({
          where: { tenantId, subIndustryId }
        });

        if (currentSubscription) {
          await tx.tenantSubscription.update({
            where: { id: currentSubscription.id },
            data: {
              branchId: session.branchId,
              createdByUserId: session.createdByUserId,
              tierId,
              status: "active",
              startedAt: now,
              currentPeriodEnd,
              price: session.subtotal
            }
          });
        } else {
          await tx.tenantSubscription.create({
            data: {
              tenantId,
              branchId: session.branchId,
              createdByUserId: session.createdByUserId,
              subIndustryId,
              tierId,
              status: "active",
              startedAt: now,
              currentPeriodEnd,
              price: session.subtotal
            }
          });
        }
      }

      await this.activateAddOns(tx, {
        tenantId,
        branchId: session.branchId,
        purchasedByUserId: session.createdByUserId,
        checkoutSessionId: session.id,
        currentPeriodEnd,
        now,
        items: addOnItems
      });

      await tx.billingCheckoutSession.update({
        where: { id: session.id },
        data: {
          status: "paid",
          paidAt: now,
          providerInvoiceId: providerInvoiceId ?? session.providerInvoiceId,
          followUpStatus: addOnItems.length && !hasSubscriptionLine ? "paid_addon" : session.followUpStatus
        }
      });
    });
  }

  private async markSessionPaid(
    sessionId: string,
    options: { providerInvoiceId?: string | null; followUpStatus?: string | null }
  ) {
    await this.prisma.billingCheckoutSession.update({
      where: { id: sessionId },
      data: {
        status: "paid",
        paidAt: new Date(),
        providerInvoiceId: options.providerInvoiceId,
        ...(options.followUpStatus ? { followUpStatus: options.followUpStatus } : {})
      }
    });
  }

  private getAddOnItems(itemsJson: unknown): NormalizedCheckoutItem[] {
    if (!Array.isArray(itemsJson)) return [];
    return itemsJson
      .filter((item): item is NormalizedCheckoutItem => {
        if (!item || typeof item !== "object") return false;
        const maybe = item as Partial<NormalizedCheckoutItem>;
        return maybe.itemType === "addon" && typeof maybe.addOnId === "string" && maybe.addOnId.length > 0;
      })
      .map((item) => ({
        ...item,
        amount: Math.ceil(Number(item.amount) || 0)
      }));
  }

  private async activateAddOns(
    tx: any,
    input: {
      tenantId: string;
      branchId?: string | null;
      purchasedByUserId?: string | null;
      checkoutSessionId: string;
      currentPeriodEnd: Date;
      now: Date;
      items: NormalizedCheckoutItem[];
    }
  ) {
    for (const item of input.items) {
      const addOn = await tx.addOn.findFirst({
        where: {
          isActive: true,
          OR: [{ id: item.addOnId ?? "" }, { slug: item.addOnId ?? "" }]
        }
      });
      if (!addOn) continue;

      const existing = await tx.tenantAddOn.findFirst({
        where: {
          tenantId: input.tenantId,
          addOnId: addOn.id,
          branchId: input.branchId ?? null
        }
      });

      const data = {
        status: "active",
        startedAt: input.now,
        currentPeriodEnd: input.currentPeriodEnd,
        price: item.amount || addOn.amount,
        purchasedByUserId: input.purchasedByUserId ?? null,
        checkoutSessionId: input.checkoutSessionId,
        metadata: {
          checkoutItem: {
            industryName: item.industryName,
            segmentName: item.segmentName,
            tierName: item.tierName,
            addOnId: item.addOnId
          }
        }
      };

      if (existing) {
        await tx.tenantAddOn.update({ where: { id: existing.id }, data });
      } else {
        await tx.tenantAddOn.create({
          data: {
            tenantId: input.tenantId,
            branchId: input.branchId ?? null,
            addOnId: addOn.id,
            ...data
          }
        });
      }
    }
  }

  private getPlanDurationDays(tierName: string) {
    return tierName.toLowerCase().includes("enterprise") ? 365 : 30;
  }

  private normalizeItem(item: CheckoutItemInput) {
    const amount = Math.ceil(Number(item.amount));
    if (!Number.isFinite(amount) || amount < 1000) {
      throw new BadRequestException(`Harga ${item.segmentName} tidak valid.`);
    }

    return {
      itemType: item.itemType ?? "subscription",
      addOnId: item.addOnId?.trim() || null,
      industryName: item.industryName.trim(),
      segmentName: item.segmentName.trim(),
      tierName: item.tierName.trim(),
      amount
    };
  }

  private calculateGatewayFee(amount: number, method: CheckoutPaymentMethod) {
    if (method === "qris") {
      return Math.ceil(amount / (1 - qrisFeeRate) - amount);
    }
    if (method === "card") {
      return Math.ceil((amount + cardFixedFee) / (1 - cardFeeRate) - amount);
    }
    return bankTransferFee;
  }

  private async createXenditInvoice({
    secretKey,
    externalId,
    method,
    customer,
    items,
    source,
    checkoutType,
    subtotal,
    tax,
    gatewayFee,
    total
  }: {
    secretKey: string;
    externalId: string;
    method: CheckoutPaymentMethod;
    customer?: CheckoutCustomerInput;
    items: NormalizedCheckoutItem[];
    source: "landing" | "portal";
    checkoutType: "new_subscription" | "add_app" | "upgrade" | "renew";
    subtotal: number;
    tax: number;
    gatewayFee: number;
    total: number;
  }) {
    const appUrl = source === "portal"
      ? this.config.get<string>("PORTAL_URL") ?? "https://omnia-portal.vercel.app"
      : this.config.get<string>("LANDING_PUBLIC_URL") ?? "https://omnia-landing-page.vercel.app";
    const redirectPath = source === "portal" ? "/portal/billing" : "/pricing";
    const apiUrl = this.config.get<string>("XENDIT_API_URL") ?? "https://api.xendit.co";
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const customerName = customer?.name?.trim() || "Customer Omnia";
    const [givenName, ...surnameParts] = customerName.split(" ");
    const payload = {
      external_id: externalId,
      amount: total,
      description: `Omnia subscription checkout (${items.length} aplikasi)`,
      invoice_duration: 86400,
      currency: "IDR",
      payment_methods: xenditPaymentMethods[method],
      success_redirect_url: `${appUrl}${redirectPath}?checkout=success&ref=${externalId}`,
      failure_redirect_url: `${appUrl}${redirectPath}?checkout=failed&ref=${externalId}`,
      customer: {
        given_names: givenName,
        surname: surnameParts.join(" ") || "-",
        email: customer?.email || undefined,
        mobile_number: customer?.phone || undefined
      },
      items: [
        ...items.map((item) => ({
          name: `${item.segmentName} - ${item.tierName}`,
          quantity: 1,
          price: item.amount,
          category: item.industryName
        })),
        {
          name: "PPN 11%",
          quantity: 1,
          price: tax,
          category: "Tax"
        }
      ],
      fees: [
        {
          type: `Biaya payment gateway ${method.toUpperCase()}`,
          value: gatewayFee
        }
      ],
      metadata: {
        subtotal,
        tax,
        gatewayFee,
        gatewayFeeChargedTo: "customer",
        paymentProvider: "xendit",
        preferredMethod: method,
        source,
        checkoutType
      }
    };

    const response = await fetch(`${apiUrl}/v2/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BadRequestException({
        message: "Gagal membuat invoice Xendit.",
        providerStatus: response.status,
        providerResponse: body
      });
    }

    return body as { id: string; invoice_url: string; status: string };
  }
}
