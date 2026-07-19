import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

type Entity = "industries" | "sub-industries" | "tiers" | "features" | "tier-features" | "users";

const modelMap: Record<Exclude<Entity, "sub-industries" | "tier-features">, keyof PrismaService> = {
  industries: "industry",
  tiers: "tier",
  features: "feature",
  users: "user"
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const socialCommerceSegment = {
  name: "Social Commerce Intelligence",
  slug: "e-commerce-marketplace-social-commerce-intelligence",
  need: "Sinyal produk, creator, live, ads, dan kompetitor tersebar di banyak marketplace.",
  offer: "Product radar, creator signal, competitor watchlist, connector status, alert center, action cards."
};

const allowedFields: Record<Entity, string[]> = {
  industries: ["name", "iconKey", "colorKey", "pain", "solution", "sortOrder", "isActive"],
  "sub-industries": ["industryId", "name", "iconKey", "colorKey", "need", "offer", "sortOrder", "isActive"],
  tiers: ["subIndustryId", "name", "price", "cadence", "description", "fit", "limits", "sortOrder", "highlight", "isActive"],
  features: ["subIndustryId", "name", "description", "sortOrder", "isActive"],
  "tier-features": ["tierId", "featureId", "included"],
  users: ["email", "password", "name", "role", "status"]
};

const maxStringLength: Record<string, number> = {
  email: 254,
  password: 128,
  name: 160,
  iconKey: 80,
  colorKey: 80,
  industryId: 80,
  subIndustryId: 80,
  tierId: 80,
  featureId: 80,
  price: 80,
  cadence: 40,
  role: 40,
  status: 40,
  pain: 1000,
  solution: 1000,
  need: 1000,
  offer: 1000,
  description: 1000,
  fit: 1000
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicCatalog() {
    const industries = await this.prisma.industry.findMany({
      where: { isActive: true, name: { not: "Internal Operations" } },
      orderBy: { sortOrder: "asc" },
      include: {
        subIndustries: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            features: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
            tiers: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: { tierFeatures: { include: { feature: true } } }
            }
          }
        }
      }
    });

    return this.withSocialCommerceSegment(industries);
  }

  async getPublicIndustries() {
    const industries = await this.prisma.industry.findMany({
      where: { isActive: true, name: { not: "Internal Operations" } },
      orderBy: { sortOrder: "asc" },
      include: { subIndustries: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } }
    });

    return this.withSocialCommerceSegment(industries);
  }

  async getPublicIndustry(slug: string) {
    const industry = await this.prisma.industry.findFirst({
      where: { slug, isActive: true },
      include: {
        subIndustries: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { tiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } }
        }
      }
    });
    if (!industry) throw new NotFoundException("Industri tidak ditemukan.");
    return this.withSocialCommerceSegment([industry])[0];
  }

  async getPublicPlans(subIndustrySlug: string) {
    const subIndustry = await this.prisma.subIndustry.findFirst({
      where: { slug: subIndustrySlug, isActive: true },
      include: {
        industry: true,
        features: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        tiers: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { tierFeatures: { include: { feature: true } } }
        }
      }
    });
    if (!subIndustry) throw new NotFoundException("Sub-industri tidak ditemukan.");
    return subIndustry;
  }

  list(entity: Entity) {
    if (entity === "sub-industries") {
      return this.prisma.subIndustry.findMany({ orderBy: { sortOrder: "asc" }, include: { industry: true } });
    }
    if (entity === "tier-features") {
      return this.prisma.tierFeature.findMany({ include: { tier: true, feature: true } });
    }
    if (entity === "users") {
      return this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          subIndustry: { select: { id: true, name: true, slug: true, industry: { select: { id: true, name: true, slug: true } } } },
          tier: { select: { id: true, name: true, slug: true } },
          tenantUsers: {
            select: {
              role: true,
              tenant: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  subscriptions: {
                    select: {
                      status: true,
                      currentPeriodEnd: true,
                      tier: { select: { name: true, slug: true, subIndustry: { select: { name: true, slug: true } } } }
                    }
                  }
                }
              }
            }
          },
          createdAt: true,
          updatedAt: true
        }
      });
    }
    const model = this.getModel(entity);
    return model.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async create(entity: Entity, body: Record<string, unknown>) {
    this.assertAllowedFields(entity, body);
    if (entity === "tier-features") {
      return this.prisma.tierFeature.upsert({
        where: { tierId_featureId: { tierId: String(body.tierId), featureId: String(body.featureId) } },
        update: { included: Boolean(body.included) },
        create: { tierId: String(body.tierId), featureId: String(body.featureId), included: Boolean(body.included) }
      });
    }
    if (entity === "users") {
      if (typeof body.email !== "string" || typeof body.password !== "string" || typeof body.name !== "string" || typeof body.role !== "string") {
        throw new BadRequestException("email, password, name, dan role wajib diisi.");
      }
      if (!["super_admin", "owner", "employee"].includes(body.role)) throw new BadRequestException("Role tidak valid.");
      if (typeof body.status === "string" && !["active", "inactive"].includes(body.status)) throw new BadRequestException("Status tidak valid.");
      if (body.password.length < 8) throw new BadRequestException("Password minimal 8 karakter.");
      return this.prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          passwordHash: await bcrypt.hash(body.password, 12),
          name: body.name,
          role: body.role as "super_admin" | "owner" | "employee",
          status: (body.status as "active" | "inactive" | undefined) ?? "active"
        },
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true }
      });
    }
    const data = this.normalizeData(entity, body);
    return this.getModel(entity).create({ data });
  }

  async update(entity: Entity, id: string, body: Record<string, unknown>) {
    this.assertAllowedFields(entity, body);
    if (entity === "users") {
      const data: Record<string, unknown> = {};
      if (typeof body.email === "string") data.email = body.email.toLowerCase();
      if (typeof body.name === "string") data.name = body.name;
      if (typeof body.role === "string") {
        if (!["super_admin", "owner", "employee"].includes(body.role)) throw new BadRequestException("Role tidak valid.");
        data.role = body.role;
      }
      if (typeof body.status === "string") {
        if (!["active", "inactive"].includes(body.status)) throw new BadRequestException("Status tidak valid.");
        data.status = body.status;
      }
      if (typeof body.password === "string" && body.password.length >= 6) {
        data.passwordHash = await bcrypt.hash(body.password, 12);
      }
      return this.prisma.user.update({
        where: { id },
        data,
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true }
      });
    }
    const data = this.normalizeData(entity, body, true);
    if (entity === "sub-industries") return this.prisma.subIndustry.update({ where: { id }, data });
    if (entity === "tier-features") return this.prisma.tierFeature.update({ where: { id }, data });
    return this.getModel(entity).update({ where: { id }, data });
  }

  remove(entity: Entity, id: string) {
    if (entity === "sub-industries") return this.prisma.subIndustry.delete({ where: { id } });
    if (entity === "tier-features") return this.prisma.tierFeature.delete({ where: { id } });
    return this.getModel(entity).delete({ where: { id } });
  }

  private getModel(entity: Entity): any {
    if (entity === "sub-industries") return this.prisma.subIndustry;
    if (entity === "tier-features") return this.prisma.tierFeature;
    const modelName = modelMap[entity as keyof typeof modelMap];
    if (!modelName) throw new BadRequestException("Resource tidak valid.");
    return this.prisma[modelName] as any;
  }

  private withSocialCommerceSegment<T extends { id: string; slug: string; subIndustries: any[] }>(industries: T[]) {
    return industries.map((industry) => {
      const isCommerceIndustry = industry.slug.includes("commerce") || industry.slug.includes("marketplace");
      const hasSocialCommerce = industry.subIndustries.some((subIndustry) => subIndustry.slug.includes("social-commerce-intelligence") || subIndustry.name === socialCommerceSegment.name);
      if (!isCommerceIndustry || hasSocialCommerce) return industry;

      return {
        ...industry,
        subIndustries: [
          ...industry.subIndustries,
          {
            id: socialCommerceSegment.slug,
            industryId: industry.id,
            ...socialCommerceSegment,
            sortOrder: industry.subIndustries.length,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            features: [],
            tiers: []
          }
        ]
      };
    });
  }

  private normalizeData(entity: Entity, body: Record<string, unknown>, partial = false): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) data[key] = value;
    }

    if ((entity === "industries" || entity === "sub-industries" || entity === "tiers") && !data.slug && typeof data.name === "string") {
      data.slug = slugify(data.name);
    }
    if (!partial && entity === "tiers" && !data.cadence) data.cadence = "/ bulan";
    if (entity === "tiers" && Array.isArray(data.limits)) {
      data.limitsJson = data.limits;
      delete data.limits;
    }

    return data;
  }

  private assertAllowedFields(entity: Entity, body: Record<string, unknown>) {
    const allowed = allowedFields[entity] ?? [];
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.includes(key)) {
        throw new BadRequestException(`Field ${key} tidak diizinkan.`);
      }
      if (typeof value === "string") {
        const normalized = value.trim();
        const maxLength = maxStringLength[key] ?? 500;
        if (normalized.length > maxLength) {
          throw new BadRequestException(`Field ${key} terlalu panjang.`);
        }
        body[key] = normalized;
      }
      if (key === "sortOrder" && Number.isNaN(Number(value))) {
        throw new BadRequestException("sortOrder harus berupa angka.");
      }
    }
  }
}
