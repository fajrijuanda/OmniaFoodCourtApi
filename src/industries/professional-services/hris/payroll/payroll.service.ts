import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async getPayrollRuns(tenantId: string, branchId?: string | null) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      include: { items: { include: { employee: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPayrollRun(tenantId: string, period: string, branchId?: string | null) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'active', ...(branchId ? { branchId } : {}) },
      include: {
        attendanceLogs: true,
        leaveRequests: { where: { status: 'Approved', type: 'Unpaid Leave' } },
        loanRequests: { where: { status: 'Approved', remainingBalance: { gt: 0 } } }
      }
    });
    if (!employees.length) throw new BadRequestException('No active employees found for payroll.');

    const settings = await this.getPayrollSettings(tenantId, branchId);
    const items = employees.map((emp, index) => this.calculatePayrollItem(emp, period, index, settings));
    const grossTotal = items.reduce((sum, item) => sum + item.grossAmount, 0);
    const deductionTotal = items.reduce((sum, item) => sum + item.deductionAmount, 0);
    const netTotal = items.reduce((sum, item) => sum + item.netAmount, 0);

    return this.prisma.payrollRun.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        period,
        status: 'draft',
        grossTotal,
        deductionTotal,
        netTotal,
        items: {
          create: items
        }
      },
      include: { items: { include: { employee: true } } }
    });
  }

  async finalizePayroll(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id, tenantId } });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status === 'finalized') {
        return tx.payrollRun.findUnique({
          where: { id },
          include: { items: { include: { employee: true } } }
        });
      }
      return tx.payrollRun.update({
        where: { id },
        data: { status: 'finalized', finalizedAt: new Date() },
        include: { items: { include: { employee: true } } }
      });
    });
  }

  async getPayslips(tenantId: string, payrollRunId: string) {
    return this.prisma.payrollRunItem.findMany({
      where: { payrollRun: { id: payrollRunId, tenantId } },
      include: { employee: true, payrollRun: true },
      orderBy: { employee: { fullName: 'asc' } }
    });
  }

  async getLatestPayslips(tenantId: string, branchId?: string | null) {
    const latestRun = await this.prisma.payrollRun.findFirst({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' }
    });
    if (!latestRun) return [];
    return this.getPayslips(tenantId, latestRun.id);
  }

  async getPayslipPdf(tenantId: string, itemId: string) {
    const item = await this.prisma.payrollRunItem.findFirst({
      where: { id: itemId, payrollRun: { tenantId } },
      include: { employee: true, payrollRun: true }
    });
    if (!item) throw new NotFoundException('Payslip not found.');

    const html = [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}h1{color:#0b3a6f}table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #e2e8f0}.total{font-size:20px;font-weight:800;color:#047857}</style>',
      '</head><body>',
      '<h1>OMNIA HRIS Payslip</h1>',
      `<p>Employee: <strong>${this.escapeHtml(item.employee.fullName)}</strong></p>`,
      `<p>Period: <strong>${this.escapeHtml(item.payrollRun.period)}</strong></p>`,
      '<table>',
      `<tr><td>Gross salary</td><td>${this.formatCurrency(Number(item.grossAmount))}</td></tr>`,
      `<tr><td>Deductions (BPJS, PPh21, unpaid leave)</td><td>${this.formatCurrency(Number(item.deductionAmount))}</td></tr>`,
      `<tr><td class="total">Net salary</td><td class="total">${this.formatCurrency(Number(item.netAmount))}</td></tr>`,
      '</table>',
      '</body></html>'
    ].join('');

    return {
      filename: `payslip-${item.employee.employeeNumber}-${item.payrollRun.period}.html`,
      mimeType: 'text/html',
      content: Buffer.from(html, 'utf8').toString('base64')
    };
  }

  private calculatePayrollItem(employee: any, period: string, index: number, settings: any) {
    const baseSalary = Number(employee.baseSalary ?? 0);
    const attendanceCount = employee.attendanceLogs?.filter((log: any) => log.clockInAt && this.isSamePeriod(log.clockInAt, period)).length ?? 0;
    const overtimeAmount = settings.overtimeEnabled === false ? 0 : Math.max(0, attendanceCount - 22) * 125000;
    const unpaidLeaveDays = this.countUnpaidLeaveDays(employee.leaveRequests ?? [], period);
    const prorateDeduction = settings.unpaidLeaveDeductionEnabled === false || settings.prorateEnabled === false ? 0 : Math.round((baseSalary / 22) * unpaidLeaveDays);
    const bpjsKesehatan = settings.bpjsEnabled === false || settings.bpjsKesehatanEnabled === false ? 0 : Math.round(Math.min(baseSalary, 12000000) * 0.01);
    const bpjsKetenagakerjaan = settings.bpjsEnabled === false || settings.bpjsKetenagakerjaanEnabled === false ? 0 : Math.round(baseSalary * 0.03);
    const taxable = Math.max(0, baseSalary + overtimeAmount - 5400000);
    const pph21 = settings.pph21Enabled === false || settings.pph21EnabledAdvanced === false ? 0 : Math.round(taxable * 0.05);
    const loanDeduction = settings.kasbonDeductionEnabled === false ? 0 : this.calculateLoanDeduction(employee.loanRequests ?? []);
    const grossAmount = baseSalary + overtimeAmount;
    const deductionAmount = bpjsKesehatan + bpjsKetenagakerjaan + pph21 + prorateDeduction + loanDeduction;

    return {
      employeeId: employee.id,
      grossAmount,
      deductionAmount,
      netAmount: grossAmount - deductionAmount,
      status: 'ready'
    };
  }

  private countUnpaidLeaveDays(leaveRequests: any[], period: string) {
    return leaveRequests.reduce((total, request) => {
      if (!this.isSamePeriod(request.startDate, period)) return total;
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      return total + Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    }, 0);
  }

  private calculateLoanDeduction(loanRequests: any[]) {
    return loanRequests.reduce((total, loan) => {
      const monthly = Number(loan.monthlyDeduction ?? 0);
      const remaining = Number(loan.remainingBalance ?? 0);
      return total + Math.min(monthly, remaining);
    }, 0);
  }

  private async getPayrollSettings(tenantId: string, branchId?: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { hrisSettings: true } });
    const source: any = tenant?.hrisSettings && typeof tenant.hrisSettings === 'object' ? tenant.hrisSettings : {};
    const defaultSettings = source.default ?? source;
    const branchSettings = branchId && source.branches && typeof source.branches === 'object' ? source.branches[branchId] : null;
    return {
      bpjsEnabled: true,
      pph21Enabled: true,
      bpjsKesehatanEnabled: true,
      bpjsKetenagakerjaanEnabled: true,
      pph21EnabledAdvanced: true,
      overtimeEnabled: true,
      prorateEnabled: true,
      unpaidLeaveDeductionEnabled: true,
      latePenaltyEnabled: false,
      taxableComponentsEnabled: true,
      kasbonDeductionEnabled: true,
      ...(defaultSettings?.payroll ?? {}),
      ...(branchSettings?.payroll ?? {})
    };
  }

  private isSamePeriod(date: Date, period: string) {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}` === period;
  }

  private formatCurrency(value: number) {
    return `Rp ${value.toLocaleString('id-ID')}`;
  }

  private escapeHtml(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
