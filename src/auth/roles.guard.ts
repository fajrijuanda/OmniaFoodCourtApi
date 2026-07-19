import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    if (request.user?.role !== "super_admin") {
      throw new ForbiddenException("Hanya super admin yang dapat mengakses resource ini.");
    }
    return true;
  }
}
