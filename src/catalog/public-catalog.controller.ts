import { Controller, Get, Param, Req } from "@nestjs/common";
import type { Request } from "express";
import { CatalogService } from "./catalog.service";

@Controller("public")
export class PublicCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("catalog")
  catalogTree() {
    return this.catalog.getPublicCatalog();
  }

  @Get("branding")
  branding(@Req() req: Request) {
    const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http").split(",")[0].trim();
    const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
    const origin = host ? `${proto}://${host}` : "";
    const logoPath = `/uploads/branding/omnia-logo.png?v=${Date.now()}`;

    return {
      name: "Omnia",
      logoPath,
      logoUrl: `${origin}${logoPath}`
    };
  }

  @Get("industries")
  industries() {
    return this.catalog.getPublicIndustries();
  }

  @Get("industries/:slug")
  industry(@Param("slug") slug: string) {
    return this.catalog.getPublicIndustry(slug);
  }

  @Get("sub-industries/:slug/plans")
  plans(@Param("slug") slug: string) {
    return this.catalog.getPublicPlans(slug);
  }
}
