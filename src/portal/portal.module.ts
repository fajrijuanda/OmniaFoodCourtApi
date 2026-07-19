import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PortalSummaryController } from "./portal-summary.controller";
import { PortalSummaryService } from "./portal-summary.service";

@Module({
  imports: [PrismaModule],
  controllers: [PortalSummaryController],
  providers: [PortalSummaryService]
})
export class PortalModule {}
