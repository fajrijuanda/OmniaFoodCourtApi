import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreateNotificationDto, NotificationQueryDto } from "./dto/notification.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(AuthGuard("jwt"))
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private getTenantId(req: any): string {
    const user = req.user;
    const tenantId = user?.tenantId ?? user?.activeTenantId ?? user?.tenantUsers?.[0]?.tenantId ?? user?.id;
    if (!tenantId) throw new Error("No tenant found for user.");
    return tenantId;
  }

  @Get()
  async list(
    @Req() req: any,
    @Query() query: NotificationQueryDto
  ) {
    const tenantId = this.getTenantId(req);
    return this.service.list(tenantId, {
      userId: req.user.id,
      status: query.status,
      category: query.category
    });
  }

  @Get("summary")
  async summary(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.summary(tenantId, req.user.id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: CreateNotificationDto) {
    const tenantId = this.getTenantId(req);
    return this.service.create({
      tenantId,
      userId: body.userId,
      title: body.title,
      body: body.body,
      category: body.category,
      priority: body.priority,
      actionUrl: body.actionUrl
    });
  }

  @Patch(":id/read")
  async markRead(@Req() req: any, @Param("id") id: string) {
    const tenantId = this.getTenantId(req);
    return this.service.markRead(id, tenantId);
  }

  @Patch("read-all")
  async markAllRead(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.markAllRead(tenantId, req.user.id);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const tenantId = this.getTenantId(req);
    return this.service.remove(id, tenantId);
  }
}
