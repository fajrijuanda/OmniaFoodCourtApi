import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { SocialCommerceIntelligenceController } from "./social-commerce-intelligence.controller";
import { SocialCommerceIntelligenceService } from "./social-commerce-intelligence.service";

@Module({
  imports: [PrismaModule],
  controllers: [SocialCommerceIntelligenceController],
  providers: [SocialCommerceIntelligenceService],
  exports: [SocialCommerceIntelligenceService]
})
export class SocialCommerceIntelligenceModule {}
