import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private defaults() {
    return {
      service: {
        defaultServiceName: "Ibadah Raya",
        defaultServiceDay: "Minggu",
        defaultServiceTime: "09:00",
        attendanceTarget: 250,
      },
      cellGroup: {
        naming: "Komsel",
        defaultSchedule: "Rabu 19:00",
        leaderApprovalRequired: true,
      },
      finance: {
        defaultDonationTypes: ["Persepuluhan", "Kolekte", "Diakonia"],
        qrisEnabled: true,
        cashCountingApproval: "bendahara_then_owner",
      },
      asset: {
        bookingApprovalRequired: true,
        maintenanceReminderDays: 30,
      },
    };
  }

  private normalizeSettings(input: unknown) {
    const source = input && typeof input === "object" ? input as Record<string, any> : {};
    const defaults = this.defaults();
    return {
      service: { ...defaults.service, ...(source.service ?? {}) },
      cellGroup: { ...defaults.cellGroup, ...(source.cellGroup ?? {}) },
      finance: { ...defaults.finance, ...(source.finance ?? {}) },
      asset: { ...defaults.asset, ...(source.asset ?? {}) },
    };
  }

  private normalizeStore(input: unknown) {
    const source = input && typeof input === "object" ? input as Record<string, any> : {};
    const defaultSettings = this.normalizeSettings(source.default ? source.default : source);
    const branchRows = source.branches && typeof source.branches === "object" ? source.branches as Record<string, unknown> : {};
    return {
      default: defaultSettings,
      branches: Object.fromEntries(Object.entries(branchRows).map(([branchId, value]) => [branchId, this.normalizeSettings(value)])),
    };
  }

  private resolve(input: unknown, branchId?: string | null) {
    const store = this.normalizeStore(input);
    if (!branchId) return { ...store.default, branchId: null, isDefault: true };
    const override = store.branches[branchId] ?? {};
    return {
      ...this.normalizeSettings({
        service: { ...store.default.service, ...(override as any).service },
        cellGroup: { ...store.default.cellGroup, ...(override as any).cellGroup },
        finance: { ...store.default.finance, ...(override as any).finance },
        asset: { ...store.default.asset, ...(override as any).asset },
      }),
      branchId,
      isDefault: false,
    };
  }

  async getSettings(tenantId: string, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { churchSettings: true } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return this.resolve(tenant.churchSettings, branchId);
  }

  async updateSettings(tenantId: string, data: Record<string, unknown>, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { churchSettings: true } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const store = this.normalizeStore(tenant.churchSettings);
    const normalized = this.normalizeSettings(data);
    const nextStore = branchId
      ? { ...store, branches: { ...store.branches, [branchId]: normalized } }
      : { ...store, default: normalized };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { churchSettings: nextStore as Prisma.InputJsonValue },
      select: { churchSettings: true },
    });
    return this.resolve(updated.churchSettings, branchId);
  }
}
