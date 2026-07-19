import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  async getLeaveRequests(tenantId: string, user: any, branchId?: string | null) {
    const canReadAll = this.canManageLeave(user);
    const selfEmployeeId = await this.resolveSelfEmployeeId(tenantId, user);
    if (!canReadAll && !selfEmployeeId) return [];

    return this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(!canReadAll && selfEmployeeId ? { employeeId: selfEmployeeId } : {})
      },
      include: { employee: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createLeaveRequest(tenantId: string, user: any, data: any, branchId?: string | null) {
    const employeeId = await this.resolveTargetEmployeeId(tenantId, user, data.employeeId);
    const employee = await this.resolveEmployee(tenantId, employeeId, branchId);
    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        branchId: branchId ?? employee.branchId ?? null,
        employeeId: employee.id,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        documentUrl: data.documentUrl,
        status: 'Pending'
      },
      include: { employee: true }
    });
  }

  async updateLeaveStatus(tenantId: string, user: any, id: string, status: string, branchId?: string | null) {
    if (!this.canManageLeave(user)) {
      throw new ForbiddenException('Akun employee tidak dapat menyetujui atau menolak leave.');
    }

    return this.prisma.leaveRequest.update({
      where: { id, tenantId },
      data: { status },
      include: { employee: true }
    });
  }

  private async resolveEmployee(tenantId: string, employeeId?: string, branchId?: string | null) {
    const employee = employeeId
      ? await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId, ...(branchId ? { branchId } : {}) } })
      : await this.prisma.employee.findFirst({ where: { tenantId, status: 'active', ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: 'asc' } });

    if (!employee) throw new NotFoundException('Employee profile not found.');
    return employee;
  }

  private async resolveTargetEmployeeId(tenantId: string, user: any, requestedEmployeeId?: string | null) {
    if (String(user?.tenantRole) === 'employee') {
      const selfEmployeeId = await this.resolveSelfEmployeeId(tenantId, user);
      if (!selfEmployeeId) throw new BadRequestException('Employee profile akun ini belum terhubung.');
      return selfEmployeeId;
    }
    return requestedEmployeeId ?? user?.employeeId;
  }

  private async resolveSelfEmployeeId(tenantId: string, user: any) {
    if (user?.employeeId) return user.employeeId;
    if (!user?.id) return null;
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        OR: [
          { userId: user.id },
          ...(user.email ? [{ email: String(user.email).toLowerCase() }] : [])
        ]
      },
      select: { id: true }
    });
    return employee?.id ?? null;
  }

  private canManageLeave(user: any) {
    if (['owner', 'admin'].includes(String(user?.tenantRole))) return true;
    return this.can(user, 'hris.leave.manage') || this.can(user, 'hris.employee.read') || this.can(user, 'hris.*');
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
