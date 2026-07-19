import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class HrisSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private defaults() {
    return {
      attendance: {
        geofenceRequired: true,
        selfieRequired: true,
        livenessRequired: true,
        workStartTime: '09:00',
        workEndTime: '18:00',
        lateToleranceMinutes: 10,
      },
      payroll: {
        cutoffDay: 25,
        payday: 28,
        overtimeFormula: 'standard',
        bpjsEnabled: true,
        pph21Enabled: true,
        bpjsKesehatanEnabled: true,
        bpjsKetenagakerjaanEnabled: true,
        jhtEnabled: true,
        jpEnabled: true,
        pph21EnabledAdvanced: true,
        overtimeEnabled: true,
        prorateEnabled: true,
        unpaidLeaveDeductionEnabled: true,
        latePenaltyEnabled: false,
        taxableComponentsEnabled: true,
        kasbonDeductionEnabled: true,
        publishPayslipAfterFinalization: true,
      },
      approval: {
        leaveFlow: 'manager_then_hr',
        reimbursementFlow: 'manager_then_finance',
        payrollFinalizer: 'owner_hr_finance',
      },
      integrations: {
        attendanceDevice: 'READY',
        accountingSync: 'READY',
        emailNotification: true,
        ssoEnabled: false,
      },
    };
  }

  private normalizeSettings(input: unknown) {
    const source = input && typeof input === 'object' ? input as Record<string, any> : {};
    const defaults = this.defaults();
    return {
      attendance: { ...defaults.attendance, ...(source.attendance ?? {}) },
      payroll: { ...defaults.payroll, ...(source.payroll ?? {}) },
      approval: { ...defaults.approval, ...(source.approval ?? {}) },
      integrations: { ...defaults.integrations, ...(source.integrations ?? {}) },
    };
  }

  private normalizeStore(input: unknown) {
    const source = input && typeof input === 'object' ? input as Record<string, any> : {};
    const defaultSettings = this.normalizeSettings(source.default ? source.default : source);
    const branchRows = source.branches && typeof source.branches === 'object' ? source.branches as any : {};
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
      attendance: { ...store.default.attendance, ...(override as any).attendance },
      payroll: { ...store.default.payroll, ...(override as any).payroll },
      approval: { ...store.default.approval, ...(override as any).approval },
      integrations: { ...store.default.integrations, ...(override as any).integrations },
      }),
      branchId,
      isDefault: false,
    };
  }

  async getSettings(tenantId: string, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { hrisSettings: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.resolve(tenant.hrisSettings, branchId);
  }

  async updateSettings(tenantId: string, data: any, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { hrisSettings: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const store = this.normalizeStore(tenant.hrisSettings);
    const normalized = this.normalizeSettings(data);
    const nextStore = branchId
      ? { ...store, branches: { ...store.branches, [branchId]: normalized } }
      : { ...store, default: normalized };
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { hrisSettings: nextStore as Prisma.InputJsonValue },
      select: { hrisSettings: true },
    });
    return this.resolve(updated.hrisSettings, branchId);
  }
}
