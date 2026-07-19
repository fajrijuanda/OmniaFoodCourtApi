import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SocialCommerceIntelligenceService } from "./social-commerce-intelligence.service";

@Controller("social-commerce-intelligence")
@UseGuards(AuthGuard("jwt"))
export class SocialCommerceIntelligenceController {
  constructor(private readonly service: SocialCommerceIntelligenceService) {}

  @Get("snapshot")
  snapshot(@Request() request: { user: any }) {
    return this.service.getSnapshot(request.user);
  }

  @Get("products")
  products(
    @Request() request: { user: any },
    @Query("channel") channel?: string,
    @Query("category") category?: string,
    @Query("status") status?: string
  ) {
    return this.service.listProducts(request.user, { channel, category, status });
  }

  @Get("creators")
  creators(@Request() request: { user: any }) {
    return this.service.listCreators(request.user);
  }

  @Get("competitors")
  competitors(@Request() request: { user: any }) {
    return this.service.listCompetitors(request.user);
  }

  @Post("competitors")
  createCompetitor(@Request() request: { user: any }, @Body() body: Record<string, unknown>) {
    return this.service.createCompetitor(request.user, body);
  }

  @Get("action-cards")
  actionCards(@Request() request: { user: any }) {
    return this.service.listActionCards(request.user);
  }

  @Get("alerts")
  alerts(@Request() request: { user: any }, @Query("status") status?: string, @Query("channel") channel?: string) {
    return this.service.listAlerts(request.user, { status, channel });
  }

  @Patch("alerts/:id")
  updateAlert(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateAlert(request.user, id, body);
  }

  @Get("connectors")
  connectors(@Request() request: { user: any }) {
    return this.service.listConnectors(request.user);
  }

  @Patch("connectors/:id")
  updateConnector(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateConnector(request.user, id, body);
  }

  @Post("experiments")
  createExperiment(@Request() request: { user: any }, @Body() body: Record<string, unknown>) {
    return this.service.createExperiment(request.user, body);
  }

  @Patch("experiments/:id")
  updateExperiment(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateExperiment(request.user, id, body);
  }
}
