import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UpdatePortalSettingsDto } from "./dto/portal-settings.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(AuthGuard("jwt"))
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("portal")
  getPortalSettings(@Req() request: any) {
    return this.settings.getPortalSettings(request.user);
  }

  @Patch("portal")
  updatePortalSettings(@Req() request: any, @Body() body: UpdatePortalSettingsDto) {
    return this.settings.updatePortalSettings(request.user, body);
  }
}
