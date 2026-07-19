import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, type?: string, startDate?: string, endDate?: string, branchId?: string | null) {
    return this.prisma.churchDonation.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(type ? { type } : {}),
        ...(startDate || endDate ? {
          date: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        } : {}),
      },
      include: {
        member: { select: { id: true, fullName: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  create(tenantId: string, data: {
    amount: number;
    type: string;
    date: string;
    paymentMethod: string;
    memberId?: string;
    notes?: string;
  }, branchId?: string | null) {
    return this.prisma.churchDonation.create({
      data: {
        tenantId,
        branchId: branchId ?? undefined,
        amount: data.amount,
        type: data.type,
        date: new Date(data.date),
        paymentMethod: data.paymentMethod,
        memberId: data.memberId,
        notes: data.notes,
      },
    });
  }

  async update(id: string, tenantId: string, data: Partial<{
    amount: number;
    type: string;
    date: string;
    paymentMethod: string;
    memberId: string;
    notes: string;
  }>, branchId?: string | null) {
    const record = await this.prisma.churchDonation.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!record) throw new NotFoundException("Donasi tidak ditemukan");
    return this.prisma.churchDonation.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.type && { type: data.type }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.memberId !== undefined && { memberId: data.memberId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  async remove(id: string, tenantId: string, branchId?: string | null) {
    const record = await this.prisma.churchDonation.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!record) throw new NotFoundException("Donasi tidak ditemukan");
    return this.prisma.churchDonation.delete({ where: { id } });
  }

  async summary(tenantId: string, branchId?: string | null) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const where = { tenantId, ...(branchId ? { branchId } : {}) };
    const [totalAll, monthDonations, yearDonations, byType] = await Promise.all([
      this.prisma.churchDonation.aggregate({ where, _sum: { amount: true } }),
      this.prisma.churchDonation.aggregate({
        where: { ...where, date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.churchDonation.aggregate({
        where: { ...where, date: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      this.prisma.churchDonation.groupBy({
        by: ["type"],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalAllTime: totalAll._sum.amount ?? 0,
      totalThisMonth: monthDonations._sum.amount ?? 0,
      totalThisYear: yearDonations._sum.amount ?? 0,
      byType,
    };
  }
}
