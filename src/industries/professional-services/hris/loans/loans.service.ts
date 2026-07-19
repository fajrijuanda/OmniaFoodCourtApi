import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

type LoanStatus = 'Pending' | 'Approved' | 'Rejected' | 'Paid';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async listLoans(tenantId: string, user: any, branchId?: string | null) {
    const canReadAll = this.can(user, 'hris.loan.approve') || this.can(user, 'hris.payroll.read') || this.can(user, 'hris.*') || ['owner', 'admin'].includes(String(user?.tenantRole));
    const selfEmployeeId = await this.resolveSelfEmployeeId(tenantId, user);
    if (!canReadAll && !selfEmployeeId) return [];

    return this.prisma.employeeLoanRequest.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(!canReadAll && selfEmployeeId ? { employeeId: selfEmployeeId } : {})
      },
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createLoan(tenantId: string, user: any, data: any, branchId?: string | null) {
    if (!this.can(user, 'hris.loan.request') && !this.can(user, 'hris.*') && !['owner', 'admin'].includes(String(user?.tenantRole))) {
      throw new ForbiddenException('Role Anda tidak memiliki akses membuat pengajuan kasbon.');
    }
    const amount = Number(data.amount);
    const installmentMonths = Math.max(1, Math.min(36, Number(data.installmentMonths) || 1));
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Nominal kasbon harus lebih dari 0.');

    const employeeId = await this.resolveTargetEmployeeId(tenantId, user, data.employeeId, branchId);
    const monthlyDeduction = Math.ceil(amount / installmentMonths);

    return this.prisma.employeeLoanRequest.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        employeeId,
        amount,
        reason: typeof data.reason === 'string' ? data.reason.trim() : null,
        installmentMonths,
        monthlyDeduction,
        remainingBalance: amount,
        status: 'Pending'
      },
      include: { employee: true }
    });
  }

  async updateStatus(tenantId: string, user: any, id: string, status: LoanStatus, notes?: string) {
    if (!this.can(user, 'hris.loan.approve') && !this.can(user, 'hris.*') && !['owner', 'admin'].includes(String(user?.tenantRole))) {
      throw new ForbiddenException('Role Anda tidak memiliki akses approval kasbon.');
    }
    if (!['Approved', 'Rejected', 'Paid'].includes(status)) throw new BadRequestException('Status kasbon tidak valid.');

    const loan = await this.prisma.employeeLoanRequest.findFirst({ where: { id, tenantId } });
    if (!loan) throw new NotFoundException('Pengajuan kasbon tidak ditemukan.');
    if (loan.status !== 'Pending' && status !== 'Paid') throw new BadRequestException('Kasbon yang sudah diputuskan tidak bisa diubah.');

    return this.prisma.employeeLoanRequest.update({
      where: { id },
      data: {
        status,
        decidedAt: new Date(),
        decidedByUserId: user?.id ?? null,
        decisionNotes: notes ?? null,
        remainingBalance: status === 'Rejected' || status === 'Paid' ? 0 : loan.remainingBalance
      },
      include: { employee: true }
    });
  }

  private async resolveTargetEmployeeId(tenantId: string, user: any, requestedEmployeeId?: string, branchId?: string | null) {
    const canCreateForOthers = this.can(user, 'hris.loan.approve') || this.can(user, 'hris.*') || ['owner', 'admin'].includes(String(user?.tenantRole));
    const targetId = canCreateForOthers && requestedEmployeeId ? requestedEmployeeId : await this.resolveSelfEmployeeId(tenantId, user);
    if (!targetId) throw new ForbiddenException('Profil employee untuk user ini belum terhubung.');

    const employee = await this.prisma.employee.findFirst({
      where: { id: targetId, tenantId, ...(branchId ? { branchId } : {}) },
      select: { id: true }
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan dalam scope tenant/cabang.');
    return employee.id;
  }

  private async resolveSelfEmployeeId(tenantId: string, user: any) {
    if (user?.employeeId) return user.employeeId;
    if (!user?.id) return null;
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    return employee?.id ?? null;
  }

  private can(user: any, permission: string) {
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (permissions.includes('*') || permissions.includes(permission)) return true;
    const parts = permission.split('.');
    for (let index = parts.length - 1; index > 0; index -= 1) {
      if (permissions.includes(`${parts.slice(0, index).join('.')}.*`)) return true;
    }
    return false;
  }
}
