import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { LmsController } from "./lms.controller";
import { LmsService } from "./lms.service";

@Module({
  imports: [PrismaModule],
  controllers: [LmsController],
  providers: [LmsService]
})
export class LmsModule {}
