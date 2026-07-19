import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { KknController } from "./kkn.controller";
import { KknService } from "./kkn.service";

@Module({
  imports: [PrismaModule],
  controllers: [KknController],
  providers: [KknService]
})
export class KknModule {}
