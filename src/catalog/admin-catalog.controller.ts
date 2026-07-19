import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SuperAdminGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";

type AdminEntity = "industries" | "sub-industries" | "tiers" | "features" | "tier-features" | "users";

@UseGuards(AuthGuard("jwt"), SuperAdminGuard)
@Controller("admin/:entity")
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Param("entity") entity: AdminEntity) {
    return this.catalog.list(entity);
  }

  @Post()
  create(@Param("entity") entity: AdminEntity, @Body() body: Record<string, unknown>) {
    return this.catalog.create(entity, body);
  }

  @Patch(":id")
  update(@Param("entity") entity: AdminEntity, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.catalog.update(entity, id, body);
  }

  @Delete(":id")
  remove(@Param("entity") entity: AdminEntity, @Param("id") id: string) {
    return this.catalog.remove(entity, id);
  }
}
