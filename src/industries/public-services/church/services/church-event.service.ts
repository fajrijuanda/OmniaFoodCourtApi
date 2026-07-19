import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";

@Injectable()
export class ChurchEventService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, eventType?: string, branchId?: string | null) {
    return this.prisma.churchEvent.findMany({
      where: {
        tenantId,
        ...(branchId ? { branchId } : {}),
        ...(eventType ? { eventType } : {}),
      },
      include: {
        volunteerSchedules: {
          include: { member: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { date: "desc" },
    });
  }

  findOne(id: string, tenantId: string, branchId?: string | null) {
    return this.prisma.churchEvent.findFirst({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      include: {
        volunteerSchedules: { include: { member: true } },
      },
    });
  }

  create(tenantId: string, data: {
    name: string;
    eventType: string;
    date: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  }, branchId?: string | null) {
    return this.prisma.churchEvent.create({
      data: {
        tenantId,
        branchId: branchId ?? undefined,
        name: data.name,
        eventType: data.eventType,
        date: new Date(data.date),
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        location: data.location,
      },
    });
  }

  async update(id: string, tenantId: string, data: Partial<{
    name: string;
    eventType: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  }>, branchId?: string | null) {
    const event = await this.prisma.churchEvent.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!event) throw new NotFoundException("Event tidak ditemukan");
    return this.prisma.churchEvent.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.eventType && { eventType: data.eventType }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.startTime !== undefined && { startTime: data.startTime ? new Date(data.startTime) : null }),
        ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
        ...(data.location !== undefined && { location: data.location }),
      },
    });
  }

  async remove(id: string, tenantId: string, branchId?: string | null) {
    const event = await this.prisma.churchEvent.findFirst({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!event) throw new NotFoundException("Event tidak ditemukan");
    return this.prisma.churchEvent.delete({ where: { id } });
  }

  // Manage volunteer schedule for an event
  async addVolunteer(tenantId: string, eventId: string, memberId: string, role: string, branchId?: string | null) {
    const event = await this.prisma.churchEvent.findFirst({ where: { id: eventId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!event) throw new NotFoundException("Event tidak ditemukan");
    const member = await this.prisma.churchMember.findFirst({ where: { id: memberId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!member) throw new NotFoundException("Jemaat tidak ditemukan");
    return this.prisma.churchVolunteerSchedule.create({
      data: { tenantId, branchId: branchId ?? event.branchId ?? null, eventId, memberId, role, status: "Pending" },
    });
  }

  updateVolunteerStatus(id: string, tenantId: string, status: string, branchId?: string | null) {
    return this.prisma.churchVolunteerSchedule.updateMany({
      where: { id, tenantId, ...(branchId ? { branchId } : {}) },
      data: { status },
    });
  }

  removeVolunteer(id: string, tenantId: string, branchId?: string | null) {
    return this.prisma.churchVolunteerSchedule.deleteMany({ where: { id, tenantId, ...(branchId ? { branchId } : {}) } });
  }
}
