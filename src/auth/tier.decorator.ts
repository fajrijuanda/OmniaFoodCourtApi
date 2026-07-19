import { SetMetadata } from "@nestjs/common";

export type TierRank = "starter" | "growth" | "pro" | "enterprise";

export const RequireTier = (subIndustrySlug: string, minimumTier: TierRank) =>
  SetMetadata("requireTier", { subIndustrySlug, minimumTier });
