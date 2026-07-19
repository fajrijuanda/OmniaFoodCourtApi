import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { PublicCatalogController } from "./public-catalog.controller";
import { AdminCatalogController } from "./admin-catalog.controller";
import { SuperAdminGuard } from "../auth/roles.guard";

@Module({
  controllers: [PublicCatalogController, AdminCatalogController],
  providers: [CatalogService, SuperAdminGuard]
})
export class CatalogModule {}
