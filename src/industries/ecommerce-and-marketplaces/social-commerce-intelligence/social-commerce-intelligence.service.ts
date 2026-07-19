import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

const channels = ["tiktok_shop", "shopee", "tokopedia", "lazada", "blibli"] as const;
const connectorStatuses = ["active", "queued", "needs_credentials", "disabled"] as const;
const experimentStatuses = ["backlog", "running", "learning", "scale", "stop"] as const;
const alertStatuses = ["unread", "read", "resolved"] as const;

type Channel = (typeof channels)[number];

function tenantIdFromUser(user: any) {
  const tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.id;
  if (!tenantId) throw new BadRequestException("Tenant ID not found in context.");
  return tenantId;
}

function branchIdFromUser(user: any) {
  return user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = "") {
  const parsed = String(value ?? fallback).trim();
  return parsed || fallback;
}

function channelLabel(channel: string) {
  const labels: Record<string, string> = {
    tiktok_shop: "TikTok Shop",
    shopee: "Shopee",
    tokopedia: "Tokopedia",
    lazada: "Lazada",
    blibli: "Blibli"
  };
  return labels[channel] ?? channel;
}

@Injectable()
export class SocialCommerceIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(user: any) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);

    const [settings, connectors, products, creators, competitors, actionCards, alerts, experiments, reports] = await Promise.all([
      this.getSettings(tenantId, branchId),
      this.getConnectorsForTenant(tenantId),
      this.listProductsForTenant(tenantId, branchId, {}),
      this.listCreatorsForTenant(tenantId, branchId),
      this.listCompetitorsForTenant(tenantId, branchId),
      this.listActionCardsForTenant(tenantId, branchId),
      this.listAlertsForTenant(tenantId, branchId, {}),
      this.listExperimentsForTenant(tenantId, branchId),
      this.listReportsForTenant(tenantId, branchId)
    ]);

    const freshProducts = products.filter((item) => item.freshnessScore >= 80).length;
    const heatingProducts = products.filter((item) => item.saturationLevel.toLowerCase() === "heating").length;
    const highConfidence = products.filter((item) => item.confidenceScore >= 80).length;
    const activeConnectors = connectors.filter((item) => item.status === "active").length;
    const openActionCards = actionCards.filter((item) => item.status === "open").length;

    return {
      dataMode: "demo_seeded",
      settings,
      connectors,
      metrics: [
        { label: "Monitored channels", value: String(connectors.length), trend: `${activeConnectors} active demo connectors`, tone: "cyan" },
        { label: "Product opportunities", value: String(products.length), trend: `${freshProducts} fresh, ${heatingProducts} heating`, tone: "pink" },
        { label: "High confidence signals", value: String(highConfidence), trend: "Confidence score >= 80", tone: "emerald" },
        { label: "Action cards open", value: String(openActionCards), trend: "Ready for campaign workflow", tone: "amber" }
      ],
      actionCards,
      products: products.slice(0, 8),
      creators: creators.slice(0, 6),
      competitors: competitors.slice(0, 6),
      alerts: alerts.slice(0, 6),
      experiments,
      reports
    };
  }

  async listProducts(user: any, filters: { channel?: string; category?: string; status?: string }) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);
    return this.listProductsForTenant(tenantId, branchId, filters);
  }

  async listCreators(user: any) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);
    return this.listCreatorsForTenant(tenantId, branchId);
  }

  async listCompetitors(user: any) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);
    return this.listCompetitorsForTenant(tenantId, branchId);
  }

  async listActionCards(user: any) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);
    return this.listActionCardsForTenant(tenantId, branchId);
  }

  async listAlerts(user: any, filters: { status?: string; channel?: string }) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchId);
    return this.listAlertsForTenant(tenantId, branchId, filters);
  }

  async listConnectors(user: any) {
    const tenantId = tenantIdFromUser(user);
    await this.seedIfEmpty(tenantId, branchIdFromUser(user));
    return this.getConnectorsForTenant(tenantId);
  }

  async updateConnector(user: any, id: string, body: Record<string, unknown>) {
    const tenantId = tenantIdFromUser(user);
    const existing = await this.prisma.socialCommerceConnector.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Connector not found.");
    const status = stringValue(body.status, existing.status);
    if (!connectorStatuses.includes(status as any)) throw new BadRequestException("Invalid connector status.");

    const row = await this.prisma.socialCommerceConnector.update({
      where: { id },
      data: {
        status,
        notes: body.notes === undefined ? existing.notes : stringValue(body.notes, ""),
        credentialHint: body.credentialHint === undefined ? existing.credentialHint : stringValue(body.credentialHint, ""),
        lastSyncAt: status === "active" ? new Date() : existing.lastSyncAt
      }
    });
    return this.formatConnector(row);
  }

  async createCompetitor(user: any, body: Record<string, unknown>) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user) ?? null;
    const shopName = stringValue(body.shopName);
    const channel = stringValue(body.channel, "tiktok_shop");
    if (!shopName) throw new BadRequestException("Shop name is required.");
    if (!channels.includes(channel as Channel)) throw new BadRequestException("Invalid channel.");

    const row = await this.prisma.socialCommerceCompetitorWatch.create({
      data: {
        tenantId,
        branchId,
        shopName,
        channel,
        category: stringValue(body.category, "Beauty"),
        movement: stringValue(body.movement, "New watchlist item"),
        risk: stringValue(body.risk, "Needs baseline"),
        response: stringValue(body.response, "Pantau 7 hari"),
        velocityScore: Math.round(numberValue(body.velocityScore, 50)),
        priceChangePct: numberValue(body.priceChangePct, 0),
        creatorCollabCount: Math.round(numberValue(body.creatorCollabCount, 0)),
        status: stringValue(body.status, "monitoring")
      }
    });
    return this.formatCompetitor(row);
  }

  async updateExperiment(user: any, id: string, body: Record<string, unknown>) {
    const tenantId = tenantIdFromUser(user);
    const existing = await this.prisma.socialCommerceExperiment.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Experiment not found.");
    const status = stringValue(body.status, existing.status);
    if (!experimentStatuses.includes(status as any)) throw new BadRequestException("Invalid experiment status.");

    const row = await this.prisma.socialCommerceExperiment.update({
      where: { id },
      data: {
        title: body.title === undefined ? existing.title : stringValue(body.title, existing.title),
        status,
        result: body.result === undefined ? existing.result : stringValue(body.result, ""),
        budget: body.budget === undefined ? existing.budget : numberValue(body.budget, Number(existing.budget))
      }
    });
    return this.formatExperiment(row);
  }

  async createExperiment(user: any, body: Record<string, unknown>) {
    const tenantId = tenantIdFromUser(user);
    const branchId = branchIdFromUser(user) ?? null;
    const title = stringValue(body.title);
    if (!title) throw new BadRequestException("Experiment title is required.");
    const status = stringValue(body.status, "backlog");
    if (!experimentStatuses.includes(status as any)) throw new BadRequestException("Invalid experiment status.");

    const row = await this.prisma.socialCommerceExperiment.create({
      data: {
        tenantId,
        branchId,
        title,
        productName: stringValue(body.productName, ""),
        channel: stringValue(body.channel, "tiktok_shop"),
        hypothesis: stringValue(body.hypothesis, "Validasi sinyal produk dengan 2 creator micro."),
        status,
        budget: numberValue(body.budget, 0),
        targetMetric: stringValue(body.targetMetric, "CPA < Rp35rb")
      }
    });
    return this.formatExperiment(row);
  }

  async updateAlert(user: any, id: string, body: Record<string, unknown>) {
    const tenantId = tenantIdFromUser(user);
    const existing = await this.prisma.socialCommerceAlert.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Alert not found.");
    const status = stringValue(body.status, existing.status);
    if (!alertStatuses.includes(status as any)) throw new BadRequestException("Invalid alert status.");
    const row = await this.prisma.socialCommerceAlert.update({ where: { id }, data: { status } });
    return this.formatAlert(row);
  }

  private async getSettings(tenantId: string, branchId?: string | null) {
    const row = await this.prisma.socialCommerceWorkspaceSetting.findFirst({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: "asc" }
    });
    return row
      ? {
          id: row.id,
          market: row.market,
          preset: row.preset,
          refreshMode: row.refreshMode,
          categories: row.categories,
          channels: row.channels,
          dataMode: row.dataMode,
          notes: row.notes
        }
      : null;
  }

  private async getConnectorsForTenant(tenantId: string) {
    const rows = await this.prisma.socialCommerceConnector.findMany({ where: { tenantId }, orderBy: [{ channel: "asc" }] });
    return rows.map((row) => this.formatConnector(row));
  }

  private async listProductsForTenant(tenantId: string, branchId: string | undefined, filters: { channel?: string; category?: string; status?: string }) {
    const rows = await this.prisma.socialCommerceProductTrend.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(filters.channel && filters.channel !== "all" ? { channel: filters.channel } : {}),
        ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
        ...(filters.status && filters.status !== "all" ? { status: filters.status } : {})
      },
      orderBy: [{ freshnessScore: "desc" }, { confidenceScore: "desc" }]
    });
    return rows.map((row) => this.formatProduct(row));
  }

  private async listCreatorsForTenant(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.socialCommerceCreatorSignal.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ fitScore: "desc" }]
    });
    return rows.map((row) => this.formatCreator(row));
  }

  private async listCompetitorsForTenant(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.socialCommerceCompetitorWatch.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ velocityScore: "desc" }, { updatedAt: "desc" }]
    });
    return rows.map((row) => this.formatCompetitor(row));
  }

  private async listActionCardsForTenant(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.socialCommerceActionCard.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    });
    return rows.map((row) => this.formatActionCard(row));
  }

  private async listAlertsForTenant(tenantId: string, branchId: string | undefined, filters: { status?: string; channel?: string }) {
    const rows = await this.prisma.socialCommerceAlert.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
        ...(filters.channel && filters.channel !== "all" ? { channel: filters.channel } : {})
      },
      orderBy: [{ triggeredAt: "desc" }]
    });
    return rows.map((row) => this.formatAlert(row));
  }

  private async listExperimentsForTenant(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.socialCommerceExperiment.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ updatedAt: "desc" }]
    });
    return rows.map((row) => this.formatExperiment(row));
  }

  private async listReportsForTenant(tenantId: string, branchId?: string | null) {
    const rows = await this.prisma.socialCommerceReport.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: [{ period: "desc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      period: row.period,
      status: row.status,
      sections: row.sections,
      summary: row.summary
    }));
  }

  private formatConnector(row: any) {
    return {
      id: row.id,
      channel: row.channel,
      label: row.displayName,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      credentialHint: row.credentialHint,
      notes: row.notes,
      metadata: row.metadata
    };
  }

  private formatProduct(row: any) {
    return {
      id: row.id,
      productName: row.productName,
      category: row.category,
      channel: row.channel,
      channelLabel: channelLabel(row.channel),
      marketplaceRank: row.marketplaceRank,
      signal: row.signal,
      freshnessScore: row.freshnessScore,
      saturationLevel: row.saturationLevel,
      confidenceScore: row.confidenceScore,
      marginEstimate: Number(row.marginEstimate),
      priceRange: `Rp${Number(row.priceMin).toLocaleString("id-ID")} - Rp${Number(row.priceMax).toLocaleString("id-ID")}`,
      priceMin: Number(row.priceMin),
      priceMax: Number(row.priceMax),
      gmvProxy: Number(row.gmvProxy),
      reviewVelocity: row.reviewVelocity,
      creatorVelocity: row.creatorVelocity,
      recommendedAction: row.recommendedAction,
      status: row.status,
      details: row.details,
      capturedAt: row.capturedAt
    };
  }

  private formatCreator(row: any) {
    return {
      id: row.id,
      handle: row.handle,
      niche: row.niche,
      channel: row.channel,
      channelLabel: channelLabel(row.channel),
      fitScore: row.fitScore,
      gmvProxy: Number(row.gmvProxy),
      commissionRange: row.commissionRange,
      audienceFit: row.audienceFit,
      riskLevel: row.riskLevel,
      note: row.note,
      metadata: row.metadata
    };
  }

  private formatCompetitor(row: any) {
    return {
      id: row.id,
      shopName: row.shopName,
      channel: row.channel,
      channelLabel: channelLabel(row.channel),
      category: row.category,
      movement: row.movement,
      risk: row.risk,
      response: row.response,
      velocityScore: row.velocityScore,
      priceChangePct: Number(row.priceChangePct),
      creatorCollabCount: row.creatorCollabCount,
      status: row.status,
      metadata: row.metadata
    };
  }

  private formatActionCard(row: any) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      confidence: row.confidence,
      actionLabel: row.actionLabel,
      moduleKey: row.moduleKey,
      priority: row.priority,
      status: row.status,
      metadata: row.metadata
    };
  }

  private formatAlert(row: any) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      channel: row.channel,
      channelLabel: row.channel ? channelLabel(row.channel) : "All channels",
      category: row.category,
      severity: row.severity,
      status: row.status,
      rule: row.rule,
      metadata: row.metadata,
      triggeredAt: row.triggeredAt
    };
  }

  private formatExperiment(row: any) {
    return {
      id: row.id,
      title: row.title,
      productName: row.productName,
      channel: row.channel,
      channelLabel: row.channel ? channelLabel(row.channel) : "All channels",
      hypothesis: row.hypothesis,
      status: row.status,
      budget: Number(row.budget),
      targetMetric: row.targetMetric,
      result: row.result,
      metadata: row.metadata
    };
  }

  private async seedIfEmpty(tenantId: string, branchId?: string | null) {
    const existing = await this.prisma.socialCommerceProductTrend.count({ where: { tenantId, ...(branchId ? { branchId } : {}) } });
    if (existing > 0) return;

    const now = new Date();
    await this.prisma.socialCommerceWorkspaceSetting.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        market: "Indonesia",
        preset: "Beauty, Home, Electronics, Fashion, FMCG",
        channels: channels as unknown as Prisma.InputJsonValue,
        categories: ["Beauty", "Home", "Electronics", "Fashion", "FMCG"] as Prisma.InputJsonValue,
        notes: "Demo seeded intelligence. Marketplace live connectors need official credentials."
      }
    });

    await this.prisma.socialCommerceConnector.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, channel: "tiktok_shop", displayName: "TikTok Shop", status: "active", lastSyncAt: now, credentialHint: "Demo mode active", notes: "Live connector queued for official API credentials." },
        { tenantId, branchId: branchId ?? null, channel: "shopee", displayName: "Shopee", status: "active", lastSyncAt: now, credentialHint: "Demo mode active", notes: "Tracks rank, review velocity, and pricing proxy." },
        { tenantId, branchId: branchId ?? null, channel: "tokopedia", displayName: "Tokopedia", status: "queued", credentialHint: "Seller API/app review required", notes: "Prepared for official integration." },
        { tenantId, branchId: branchId ?? null, channel: "lazada", displayName: "Lazada", status: "needs_credentials", credentialHint: "Open Platform credential required", notes: "Credential slot ready." },
        { tenantId, branchId: branchId ?? null, channel: "blibli", displayName: "Blibli", status: "disabled", credentialHint: "Partner API access required", notes: "Available in demo catalog." }
      ],
      skipDuplicates: true
    });

    await this.prisma.socialCommerceProductTrend.createMany({
      data: [
        this.productSeed(tenantId, branchId, "Hair serum travel pack", "Beauty", "tiktok_shop", 3, "+28% creator velocity", 92, "Fresh", 88, 34, 69000, 99000, 184000000, 312, 64, "Test bundle mini size minggu ini", "watch"),
        this.productSeed(tenantId, branchId, "Retinol body lotion", "Beauty", "shopee", 7, "+19% review velocity", 84, "Heating", 81, 31, 59000, 129000, 221000000, 428, 39, "Shortlist 5 creator skincare micro", "watch"),
        this.productSeed(tenantId, branchId, "Magnetic cable organizer", "Home", "tokopedia", 11, "+21% wishlist proxy", 79, "Heating", 74, 29, 25000, 49000, 76000000, 156, 18, "Uji angle desk setup dan paket 3 pcs", "watch"),
        this.productSeed(tenantId, branchId, "Portable blender cup", "Electronics", "lazada", 15, "Ad pressure naik", 62, "Crowded", 67, 21, 119000, 189000, 136000000, 84, 22, "Stop jika CPA di atas Rp38rb", "review"),
        this.productSeed(tenantId, branchId, "LED vanity mirror", "Beauty", "blibli", 21, "Price compression", 44, "Saturated", 82, 13, 79000, 149000, 93000000, 64, 11, "Tahan stok baru dan pantau margin", "avoid"),
        this.productSeed(tenantId, branchId, "Hijab sport instant", "Fashion", "tiktok_shop", 6, "+34% live mention", 87, "Fresh", 79, 36, 45000, 89000, 168000000, 219, 47, "Buat live script sweat test", "watch"),
        this.productSeed(tenantId, branchId, "Kopi susu literan low sugar", "FMCG", "shopee", 9, "+17% repeat purchase proxy", 76, "Heating", 72, 25, 42000, 69000, 112000000, 183, 16, "Tes bundling 2 botol + cold pack", "watch"),
        this.productSeed(tenantId, branchId, "Foldable storage box", "Home", "tokopedia", 5, "+24% cart velocity", 89, "Fresh", 85, 33, 39000, 79000, 197000000, 254, 29, "Naikkan budget demo organizing", "scale")
      ]
    });

    await this.prisma.socialCommerceCreatorSignal.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, handle: "@glowdaily.id", niche: "Beauty micro", channel: "tiktok_shop", fitScore: 92, gmvProxy: 118000000, commissionRange: "12-14%", audienceFit: "Wanita 18-34, skincare buyer", riskLevel: "low", note: "Audience match kuat untuk serum dan lotion." },
        { tenantId, branchId: branchId ?? null, handle: "@rumahrapi", niche: "Home living", channel: "shopee", fitScore: 87, gmvProxy: 76000000, commissionRange: "10-12%", audienceFit: "Home organizer buyer", riskLevel: "low", note: "Format demo meja kerja efektif." },
        { tenantId, branchId: branchId ?? null, handle: "@dealhunter.id", niche: "Affiliate deals", channel: "tokopedia", fitScore: 81, gmvProxy: 144000000, commissionRange: "14-16%", audienceFit: "Promo seeker", riskLevel: "medium", note: "Butuh margin guard." },
        { tenantId, branchId: branchId ?? null, handle: "@fitdailywear", niche: "Modest activewear", channel: "tiktok_shop", fitScore: 84, gmvProxy: 88000000, commissionRange: "11-13%", audienceFit: "Hijab sport audience", riskLevel: "low", note: "Cocok untuk sweat test." }
      ]
    });

    await this.prisma.socialCommerceCompetitorWatch.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, shopName: "Glow Lab Official", channel: "tiktok_shop", category: "Beauty", movement: "+18% GMV proxy", risk: "Creator collab spike", response: "Pantau 3 SKU serum", velocityScore: 91, priceChangePct: 0, creatorCollabCount: 12 },
        { tenantId, branchId: branchId ?? null, shopName: "Beauty Flash ID", channel: "shopee", category: "Beauty", movement: "-7% price", risk: "Voucher pressure", response: "Jangan ikut perang harga", velocityScore: 78, priceChangePct: -7, creatorCollabCount: 5 },
        { tenantId, branchId: branchId ?? null, shopName: "HomeHack Store", channel: "tokopedia", category: "Home", movement: "+9 live sessions", risk: "Live angle baru", response: "Review replay hari ini", velocityScore: 74, priceChangePct: 2, creatorCollabCount: 3 },
        { tenantId, branchId: branchId ?? null, shopName: "Active Modest Co", channel: "tiktok_shop", category: "Fashion", movement: "+26% mention", risk: "Hijab sport angle naik", response: "Siapkan comparison script", velocityScore: 83, priceChangePct: 0, creatorCollabCount: 8 }
      ]
    });

    await this.prisma.socialCommerceActionCard.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, title: "Test hair serum mini size minggu ini", body: "Freshness tinggi di TikTok Shop, creator crowding rendah, margin aman pada harga Rp89rb.", confidence: "High", actionLabel: "Buat experiment", moduleKey: "product-radar", priority: "high" },
        { tenantId, branchId: branchId ?? null, title: "Naikkan komisi affiliate serum ke 14%", body: "Top creator beauty merespons lebih cepat di komisi 13-15% pada benchmark kategori.", confidence: "Medium", actionLabel: "Update campaign", moduleKey: "campaign-planner", priority: "normal" },
        { tenantId, branchId: branchId ?? null, title: "Tahan produk LED vanity mirror", body: "Seller crowding naik dan price compression mulai menekan margin.", confidence: "High", actionLabel: "Mark as crowded", moduleKey: "alerts", priority: "high" }
      ]
    });

    await this.prisma.socialCommerceAlert.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, title: "Fresh trend detected", body: "Hair serum travel pack melewati freshness 90 di TikTok Shop.", channel: "tiktok_shop", category: "Beauty", severity: "high", rule: "Freshness score > 85" },
        { tenantId, branchId: branchId ?? null, title: "Competitor spike", body: "Glow Lab Official naik +18% GMV proxy dalam 3 hari.", channel: "tiktok_shop", category: "Beauty", severity: "high", rule: "Competitor velocity naik 3 hari" },
        { tenantId, branchId: branchId ?? null, title: "Margin warning", body: "LED vanity mirror masuk zona margin safety 13%.", channel: "blibli", category: "Beauty", severity: "normal", rule: "Margin safety turun di bawah 20%" }
      ]
    });

    await this.prisma.socialCommerceExperiment.createMany({
      data: [
        { tenantId, branchId: branchId ?? null, title: "Serum mini: 3 creator micro", productName: "Hair serum travel pack", channel: "tiktok_shop", hypothesis: "Creator micro dengan before-after hook bisa menjaga CPA < Rp35rb.", status: "running", budget: 1500000, targetMetric: "CPA < Rp35rb" },
        { tenantId, branchId: branchId ?? null, title: "Cable organizer desk setup", productName: "Magnetic cable organizer", channel: "tokopedia", hypothesis: "Demo setup meja meningkatkan save rate dan cart velocity.", status: "backlog", budget: 750000, targetMetric: "Cart velocity +15%" },
        { tenantId, branchId: branchId ?? null, title: "Portable blender stop rule", productName: "Portable blender cup", channel: "lazada", hypothesis: "Produk tetap viable jika CPA di bawah Rp38rb.", status: "learning", budget: 1000000, targetMetric: "CPA < Rp38rb", result: "Ad pressure tinggi, perlu angle baru." }
      ]
    });

    await this.prisma.socialCommerceReport.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        title: "Weekly opportunity report",
        period: now.toISOString().slice(0, 10),
        summary: "Beauty dan Fashion memberi sinyal fresh tertinggi. Home organizer stabil untuk campaign evergreen. Hindari SKU crowded sampai margin membaik.",
        sections: ["Executive summary", "Product opportunities", "Competitor movement", "Creator shortlist", "Campaign recommendation", "Risk and saturation warning", "Next 7-day action plan"] as Prisma.InputJsonValue
      }
    });
  }

  private productSeed(
    tenantId: string,
    branchId: string | null | undefined,
    productName: string,
    category: string,
    channel: Channel,
    marketplaceRank: number,
    signal: string,
    freshnessScore: number,
    saturationLevel: string,
    confidenceScore: number,
    marginEstimate: number,
    priceMin: number,
    priceMax: number,
    gmvProxy: number,
    reviewVelocity: number,
    creatorVelocity: number,
    recommendedAction: string,
    status: string
  ) {
    return {
      tenantId,
      branchId: branchId ?? null,
      productName,
      category,
      channel,
      marketplaceRank,
      signal,
      freshnessScore,
      saturationLevel,
      confidenceScore,
      marginEstimate,
      priceMin,
      priceMax,
      gmvProxy,
      reviewVelocity,
      creatorVelocity,
      recommendedAction,
      status,
      details: { source: "demo_seeded", disclaimer: "Not live marketplace data" }
    };
  }
}
