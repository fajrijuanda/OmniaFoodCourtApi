import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { ChurchMemberController } from "./controllers/church-member.controller";
import { ChurchCellGroupController } from "./controllers/church-cell-group.controller";
import { ChurchEventController } from "./controllers/church-event.controller";
import { ChurchFinanceController } from "./controllers/church-finance.controller";
import { ChurchAssetController } from "./controllers/church-asset.controller";
import { ChurchSettingsController } from "./controllers/church-settings.controller";
import { ChurchMemberService } from "./services/church-member.service";
import { ChurchCellGroupService } from "./services/church-cell-group.service";
import { ChurchEventService } from "./services/church-event.service";
import { ChurchFinanceService } from "./services/church-finance.service";
import { ChurchAssetService } from "./services/church-asset.service";
import { ChurchSettingsService } from "./services/church-settings.service";

@Module({
  imports: [PrismaModule],
  controllers: [ChurchMemberController, ChurchCellGroupController, ChurchEventController, ChurchFinanceController, ChurchAssetController, ChurchSettingsController],
  providers: [ChurchMemberService, ChurchCellGroupService, ChurchEventService, ChurchFinanceService, ChurchAssetService, ChurchSettingsService],
})
export class ChurchModule {}
