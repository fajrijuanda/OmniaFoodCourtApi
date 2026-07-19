import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from '../decorators/require-feature.decorator';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const normalizeFeatureKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');

const featureAliases: Record<string, string[]> = {
  'attendance-selfie': [
    'ai-face-recognition-liveness-attendance',
    'face-recognition-liveness-attendance',
    'liveness-attendance'
  ]
};

@Injectable()
export class TierGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId ?? req.user?.tenantUsers?.[0]?.tenantId ?? req.user?.tenantUsers?.[0]?.tenant?.id;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }
    const branchId = req.user?.activeBranchId ?? req.user?.branchId ?? null;

    // Check all active subscriptions for the tenant. Employees inherit the same
    // tenant subscription as the owner/admin, so the guard must not stop at the
    // first subscription when a tenant has multiple products.
    const subscriptions = await prisma.tenantSubscription.findMany({
      where: { tenantId, status: { in: ['active', 'trial'] } },
      include: {
        tier: {
          include: {
            subIndustry: { include: { industry: true } },
            tierFeatures: {
              include: { feature: true }
            }
          }
        }
      }
    });

    const normalizedRequiredFeature = normalizeFeatureKey(requiredFeature);
    const acceptedFeatureKeys = new Set([normalizedRequiredFeature, ...(featureAliases[normalizedRequiredFeature] ?? [])]);
    const hasFeature = subscriptions.some((sub) =>
      sub.tier.tierFeatures.some((tf) =>
        tf.included && (
          tf.feature.name === requiredFeature ||
          acceptedFeatureKeys.has(normalizeFeatureKey(tf.feature.name))
        )
      )
    );

    if (hasFeature) {
      return true;
    }

    const hasSubscribedFeatureFamily = normalizedRequiredFeature === 'attendance-selfie' && subscriptions.some((sub) => {
      const scope = `${sub.tier.subIndustry?.slug ?? ''} ${sub.tier.subIndustry?.name ?? ''} ${sub.tier.subIndustry?.industry?.slug ?? ''}`.toLowerCase();
      return scope.includes('hris') || scope.includes('human-resource') || scope.includes('professional-services');
    });

    if (hasSubscribedFeatureFamily) {
      return true;
    }

    const addOn = await prisma.tenantAddOn.findFirst({
      where: {
        tenantId,
        status: 'active',
        OR: [{ branchId }, { branchId: null }],
        addOn: {
          isActive: true,
          OR: [
            { slug: normalizedRequiredFeature },
            { name: { equals: requiredFeature, mode: 'insensitive' } },
            { name: { contains: requiredFeature, mode: 'insensitive' } }
          ]
        }
      }
    });

    if (addOn) {
      return true;
    }

    throw new ForbiddenException(`Your current plan does not support feature: ${requiredFeature}. Please upgrade your tier.`);
  }
}
