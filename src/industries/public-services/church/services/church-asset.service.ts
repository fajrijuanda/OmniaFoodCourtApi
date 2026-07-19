import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchAssetService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, status?: string, branchId?: string | null) {
    return this.prisma.churchAsset.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  findOne(id: string, tenantId: string, branchId?: string | null) {
    return this.prisma.churchAsset.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
  }

  create(tenantId: string, data: {
    name: string;
    type: string;
    location?: string;
    status?: string;
  }, branchId?: string | null) {
    return this.prisma.churchAsset.create({
      data: { tenantId, branchId: branchId ?? undefined, ...data, status: data.status ?? "Tersedia" },
    });
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string;
    type: string;
    location: string;
    status: string;
  }>, branchId?: string | null) {
    const asset = await this.prisma.churchAsset.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!asset) throw new NotFoundException("Aset tidak ditemukan");
    return this.prisma.churchAsset.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string, branchId?: string | null) {
    const asset = await this.prisma.churchAsset.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!asset) throw new NotFoundException("Aset tidak ditemukan");
    return this.prisma.churchAsset.delete({ where: { id } });
  }

  async stats(tenantId: string, branchId?: string | null) {
    const where = { tenantId, ...(branchId ? { branchId } : {}) };
    const [total, tersedia, dipinjam, rusak] = await Promise.all([
      this.prisma.churchAsset.count({ where }),
      this.prisma.churchAsset.count({ where: { ...where, status: "Tersedia" } }),
      this.prisma.churchAsset.count({ where: { ...where, status: "Dipinjam" } }),
      this.prisma.churchAsset.count({ where: { ...where, status: "Rusak" } }),
    ]);
    return { total, tersedia, dipinjam, rusak };
  }
}
