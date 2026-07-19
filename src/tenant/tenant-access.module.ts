import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TenantAccessController } from "./tenant-access.controller";
import { TenantAccessService } from "./tenant-access.service";

@Module({
  imports: [PrismaModule],
  controllers: [TenantAccessController],
  providers: [TenantAccessService],
  exports: [TenantAccessService]
})
export class TenantAccessModule {}
