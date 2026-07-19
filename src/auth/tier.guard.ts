import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TierRank } from "./tier.decorator";

const TIER_RANK_MAP: Record<TierRank, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4
};

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireTier = this.reflector.getAllAndOverride<{ subIndustrySlug: string; minimumTier: TierRank }>("requireTier", [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requireTier) {
      return true; // No tier required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // In a real multi-tenant app, the active tenant ID would be sent in the header (e.g. x-tenant-id).
    // For simplicity, we just use the first tenant the user belongs to.
    const activeTenantUser = user?.tenantUsers?.find?.((item: any) => item.tenantId === user?.tenantId || item.tenantId === user?.activeTenantId) ?? user?.tenantUsers?.[0];
    if (!activeTenantUser) {
      throw new ForbiddenException("Anda tidak memiliki akses ke tenant manapun.");
    }

    // Find subscription for the requested sub-industry
    const subscription = activeTenantUser.tenant.subscriptions.find(
      (sub: any) => sub.tier.subIndustry.slug === requireTier.subIndustrySlug || sub.tier.slug.includes(requireTier.subIndustrySlug)
    );

    if (!subscription) {
      throw new ForbiddenException(`Tenant ini belum berlangganan modul ${requireTier.subIndustrySlug}.`);
    }

    // Validate Status
    if (subscription.status !== "active" && subscription.status !== "trial") {
      throw new ForbiddenException(`Langganan ${requireTier.subIndustrySlug} Anda sedang tidak aktif.`);
    }

    if (subscription.status === "trial" && new Date(subscription.currentPeriodEnd).getTime() < Date.now()) {
      throw new ForbiddenException(`Masa trial ${requireTier.subIndustrySlug} Anda telah habis.`);
    }

    // Check Tier Rank
    // Tier slug usually looks like "hris-and-payroll-growth"
    const tierSlug = subscription.tier.slug.toLowerCase();
    
    let currentRank = 1;
    if (tierSlug.includes("enterprise")) currentRank = 4;
    else if (tierSlug.includes("pro")) currentRank = 3;
    else if (tierSlug.includes("growth")) currentRank = 2;
    else if (tierSlug.includes("starter")) currentRank = 1;

    const requiredRank = TIER_RANK_MAP[requireTier.minimumTier];

    if (currentRank < requiredRank) {
      throw new ForbiddenException(
        `Fitur ini membutuhkan minimal tier ${requireTier.minimumTier.toUpperCase()}. Tier Anda saat ini belum mencukupi.`
      );
    }

    return true;
  }
}
