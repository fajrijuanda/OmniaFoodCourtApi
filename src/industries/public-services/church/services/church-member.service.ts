import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchMemberService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, search?: string, branchId?: string | null) {
    return this.prisma.churchMember.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(search ? { fullName: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { fullName: "asc" },
    });
  }

  findOne(id: string, tenantId: string, branchId?: string | null) {
    return this.prisma.churchMember.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      include: {
        cellGroupMembers: { include: { cellGroup: true } },
        volunteerSchedules: { include: { event: true } },
        donations: { orderBy: { date: "desc" }, take: 10 },
      },
    });
  }

  create(tenantId: string, data: {
    fullName: string;
    gender?: string;
    dob?: string;
    phoneNumber?: string;
    address?: string;
    status?: string;
    familyGroupId?: string;
  }, branchId?: string | null) {
    return this.prisma.churchMember.create({
      data: {
        tenantId,
        branchId: branchId ?? undefined,
        fullName: data.fullName,
        gender: data.gender,
        dob: data.dob ? new Date(data.dob) : undefined,
        phoneNumber: data.phoneNumber,
        address: data.address,
        status: data.status ?? "Simpatisan",
        familyGroupId: data.familyGroupId,
      },
    });
  }

  async update(id: string, tenantId: string, data: Partial<{
    fullName: string;
    gender: string;
    dob: string;
    phoneNumber: string;
    address: string;
    status: string;
    familyGroupId: string;
  }>, branchId?: string | null) {
    const member = await this.prisma.churchMember.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!member) throw new NotFoundException("Member tidak ditemukan");
    return this.prisma.churchMember.update({
      where: { id },
      data: {
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dob !== undefined && { dob: data.dob ? new Date(data.dob) : null }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.status && { status: data.status }),
        ...(data.familyGroupId !== undefined && { familyGroupId: data.familyGroupId }),
      },
    });
  }

  async remove(id: string, tenantId: string, branchId?: string | null) {
    const member = await this.prisma.churchMember.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!member) throw new NotFoundException("Member tidak ditemukan");
    return this.prisma.churchMember.delete({ where: { id } });
  }

  stats(tenantId: string, branchId?: string | null) {
    const where = { tenantId, ...(branchId ? { branchId } : {}) };
    return Promise.all([
      this.prisma.churchMember.count({ where }),
      this.prisma.churchMember.count({ where: { ...where, status: "Jemaat Tetap" } }),
      this.prisma.churchMember.count({ where: { ...where, status: "Simpatisan" } }),
      this.prisma.churchMember.count({ where: { ...where, gender: "Male" } }),
      this.prisma.churchMember.count({ where: { ...where, gender: "Female" } }),
    ]).then(([total, tetap, simpatisan, male, female]) => ({
      total, tetap, simpatisan, male, female,
    }));
  }
}
