import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type CreateNotificationInput = {
  tenantId: string;
  userId?: string;
  title: string;
  body: string;
  category: string;
  priority?: string;
  actionUrl?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List notifications for a tenant. Optionally filter by userId and/or status.
   */
  async list(tenantId: string, filters?: { userId?: string; status?: string; category?: string }) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        ...(filters?.userId ? { userId: filters.userId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.category ? { category: filters.category } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  /**
   * Get summary counts for a tenant.
   */
  async summary(tenantId: string, userId?: string) {
    const where = { tenantId, ...(userId ? { OR: [{ userId }, { userId: null }] } : {}) };

    const [total, unread, highPriority] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, status: "unread" } }),
      this.prisma.notification.count({ where: { ...where, priority: "high" } })
    ]);

    return { total, unread, highPriority };
  }

  /**
   * Create a new notification.
   */
  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        title: input.title,
        body: input.body,
        category: input.category,
        priority: input.priority ?? "normal",
        actionUrl: input.actionUrl ?? null
      }
    });
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(id: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId },
      data: { status: "read" }
    });
  }

  /**
   * Mark all notifications as read for a tenant (optionally scoped to a user).
   */
  async markAllRead(tenantId: string, userId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        tenantId,
        status: "unread",
        ...(userId ? { OR: [{ userId }, { userId: null }] } : {})
      },
      data: { status: "read" }
    });
  }

  /**
   * Delete a notification.
   */
  async remove(id: string, tenantId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, tenantId }
    });
  }
}
