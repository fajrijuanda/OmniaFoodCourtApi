import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_PERMISSION_KEY } from "../decorators/require-permission.decorator";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
    if (user?.tenantRole === "owner" || permissions.includes("*") || permissions.includes(required)) return true;

    const parts = required.split(".");
    for (let index = parts.length - 1; index > 0; index -= 1) {
      const wildcard = parts.slice(0, index).join(".") + ".*";
      if (permissions.includes(wildcard)) return true;
    }

    throw new ForbiddenException("Role Anda tidak memiliki permission untuk aksi ini.");
  }
}
