import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PortalSummaryService } from "./portal-summary.service";

@Controller("portal")
@UseGuards(AuthGuard("jwt"))
export class PortalSummaryController {
  constructor(private readonly service: PortalSummaryService) {}

  @Get("summary")
  summary(@Req() req: any) {
    return this.service.getSummary(req.user);
  }

  @Get("catalog")
  catalog(@Req() req: any) {
    return this.service.getCatalog(req.user);
  }
}
