import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchCellGroupService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, branchId?: string | null) {
    return this.prisma.churchCellGroup.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      include: {
        members: { include: { member: { select: { id: true, fullName: true, status: true } } } },
      },
      orderBy: { name: "asc" },
    });
  }

  findOne(id: string, tenantId: string, branchId?: string | null) {
    return this.prisma.churchCellGroup.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      include: {
        members: { include: { member: true } },
      },
    });
  }

  create(tenantId: string, data: {
    name: string;
    leaderId?: string;
    schedule?: string;
    location?: string;
  }, branchId?: string | null) {
    return this.prisma.churchCellGroup.create({
      data: { tenantId, branchId: branchId ?? undefined, ...data },
    });
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string;
    leaderId: string;
    schedule: string;
    location: string;
  }>, branchId?: string | null) {
    const group = await this.prisma.churchCellGroup.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!group) throw new NotFoundException("Komsel tidak ditemukan");
    return this.prisma.churchCellGroup.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string, branchId?: string | null) {
    const group = await this.prisma.churchCellGroup.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!group) throw new NotFoundException("Komsel tidak ditemukan");
    return this.prisma.churchCellGroup.delete({ where: { id } });
  }

  async addMember(cellGroupId: string, tenantId: string, memberId: string, branchId?: string | null) {
    const group = await this.prisma.churchCellGroup.findFirst({ where: { id: cellGroupId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!group) throw new NotFoundException("Komsel tidak ditemukan");
    const member = await this.prisma.churchMember.findFirst({ where: { id: memberId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!member) throw new NotFoundException("Jemaat tidak ditemukan");
    return this.prisma.churchCellGroupMember.upsert({
      where: { cellGroupId_memberId: { cellGroupId, memberId } },
      create: { cellGroupId, memberId },
      update: {},
    });
  }

  async removeMember(cellGroupId: string, tenantId: string, memberId: string, branchId?: string | null) {
    const group = await this.prisma.churchCellGroup.findFirst({ where: { id: cellGroupId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!group) throw new NotFoundException("Komsel tidak ditemukan");
    return this.prisma.churchCellGroupMember.deleteMany({ where: { cellGroupId, memberId } });
  }
}
