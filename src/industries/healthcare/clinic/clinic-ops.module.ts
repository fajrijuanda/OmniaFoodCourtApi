import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { ClinicOpsController } from "./clinic-ops.controller";
import { ClinicOpsService } from "./clinic-ops.service";

@Module({
  imports: [PrismaModule],
  controllers: [ClinicOpsController],
  providers: [ClinicOpsService]
})
export class ClinicOpsModule {}
