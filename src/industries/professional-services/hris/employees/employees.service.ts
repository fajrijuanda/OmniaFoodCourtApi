import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async getEmployees(tenantId: string, user: any, search?: string, branchId?: string | null, status = 'active') {
    const canReadAll = this.can(user, 'hris.employee.read') || this.can(user, 'hris.*') || ['owner', 'admin'].includes(String(user?.tenantRole));
    const selfEmployeeId = await this.resolveSelfEmployeeId(tenantId, user);
    if (!canReadAll && !selfEmployeeId) return [];
    const statusFilter = this.resolveStatusFilter(status);

    return this.prisma.employee.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(!canReadAll && selfEmployeeId ? { id: selfEmployeeId } : {}),
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { employeeNumber: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: { department: true, user: { select: { id: true, email: true, mustChangePassword: true, status: true } } },
      orderBy: { fullName: 'asc' }
    });
  }

  async createEmployee(tenantId: string, user: any, data: any, branchId?: string | null) {
    this.assertCanWrite(user, 'Role Anda tidak memiliki akses membuat employee.');
    const email = this.normalizeEmail(data.email);
    if (!email) throw new BadRequestException('Email kerja wajib diisi untuk membuat akun employee.');
    if (!data.fullName || typeof data.fullName !== 'string') throw new BadRequestException('Nama lengkap wajib diisi.');

    return this.prisma.$transaction(async (tx) => {
      const existingEmployee = await tx.employee.findFirst({ where: { tenantId, email } });
      if (existingEmployee) throw new BadRequestException('Email kerja sudah terdaftar sebagai employee tenant ini.');

      const existingUser = await tx.user.findUnique({
        where: { email },
        include: { tenantUsers: true }
      });

      const account = existingUser ?? await tx.user.create({
        data: {
          email,
          name: data.fullName.trim(),
          passwordHash: await bcrypt.hash('user12345', 12),
          mustChangePassword: true,
          role: 'employee',
          status: 'active'
        }
      });

      const tenantUser = await tx.tenantUser.upsert({
        where: { userId_tenantId: { userId: account.id, tenantId } },
        update: { role: 'employee' },
        create: { userId: account.id, tenantId, role: 'employee' }
      });

      const targetBranchId = branchId ?? null;
      if (targetBranchId) {
        await tx.tenantUserBranch.upsert({
          where: { tenantUserId_branchId: { tenantUserId: tenantUser.id, branchId: targetBranchId } },
          update: {},
          create: { tenantUserId: tenantUser.id, branchId: targetBranchId }
        });
      }

      const employeeNumber = await this.nextEmployeeNumber(tx, tenantId);

      return tx.employee.create({
        data: {
          tenantId,
          branchId: targetBranchId,
          userId: account.id,
          employeeNumber,
          email,
          fullName: data.fullName.trim(),
          employmentStatus: data.employmentStatus || 'PKWTT',
          status: data.status || 'active',
          joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
          departmentId: data.departmentId || null,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber
        },
        include: { department: true, user: { select: { id: true, email: true, mustChangePassword: true, status: true } } }
      });
    });
  }

  async archiveEmployee(tenantId: string, user: any, id: string, branchId?: string | null) {
    this.assertCanWrite(user, 'Role Anda tidak memiliki akses menonaktifkan employee.');

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id,
          tenantId,
          ...(branchId ? { branchId } : {})
        },
        select: { id: true, userId: true, status: true, resignDate: true }
      });

      if (!employee) throw new NotFoundException('Employee tidak ditemukan di tenant aktif.');

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          status: 'inactive',
          resignDate: employee.resignDate ?? new Date()
        }
      });

      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { status: 'inactive' }
        });
      }

      return { id: employee.id, archived: true };
    });
  }

  async restoreEmployee(tenantId: string, user: any, id: string, branchId?: string | null) {
    this.assertCanWrite(user, 'Role Anda tidak memiliki akses memulihkan employee.');

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id,
          tenantId,
          ...(branchId ? { branchId } : {})
        },
        select: { id: true, userId: true }
      });

      if (!employee) throw new NotFoundException('Employee tidak ditemukan di tenant aktif.');

      await tx.employee.update({
        where: { id: employee.id },
        data: {
          status: 'active',
          resignDate: null
        }
      });

      if (employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: { status: 'active' }
        });
      }

      return { id: employee.id, restored: true };
    });
  }

  private normalizeEmail(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
  }

  private resolveStatusFilter(status?: string) {
    const normalized = typeof status === 'string' ? status.trim().toLowerCase() : 'active';
    if (!normalized || normalized === 'active') return 'active';
    if (['inactive', 'archived', 'arsip', 'diarsipkan'].includes(normalized)) return 'inactive';
    if (normalized === 'all' || normalized === 'semua') return undefined;
    throw new BadRequestException('Filter status employee tidak valid.');
  }

  private assertCanWrite(user: any, message: string) {
    if (!['owner', 'admin'].includes(String(user?.tenantRole))) {
      throw new ForbiddenException(message);
    }
  }

  private async nextEmployeeNumber(tx: any, tenantId: string) {
    const employees = await tx.employee.findMany({
      where: { tenantId, employeeNumber: { startsWith: 'EMP-' } },
      select: { employeeNumber: true }
    });
    const maxNumber = employees.reduce((max: number, employee: { employeeNumber: string }) => {
      const number = Number(employee.employeeNumber.replace(/^EMP-/, ''));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 0);
    return `EMP-${(maxNumber + 1).toString().padStart(4, '0')}`;
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

  private async resolveSelfEmployeeId(tenantId: string, user: any) {
    if (user?.employeeId) return user.employeeId;
    if (!user?.id) return null;
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } });
    return employee?.id ?? null;
  }
}
