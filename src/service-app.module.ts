import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { SecurityModule } from "./security/security.module";
import { StorageModule } from "./storage/storage.module";
import { CatalogModule } from "./catalog/catalog.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { BillingModule } from "./billing/billing.module";
import { SettingsModule } from "./settings/settings.module";
import { PortalModule } from "./portal/portal.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { AdminCustomersModule } from "./admin-customers/admin-customers.module";
import { TenantAccessModule } from "./tenant/tenant-access.module";
import { HrisModule } from "./industries/professional-services/hris/hris.module";
import { FnbModule } from "./industries/fnb/fnb.module";
import { ChurchModule } from "./industries/public-services/church/church.module";
import { ClinicOpsModule } from "./industries/healthcare/clinic/clinic-ops.module";
import { LmsModule } from "./industries/education-and-courses/e-learning-lms/lms.module";
import { KknModule } from "./industries/education-and-courses/kkn-and-fieldwork/kkn.module";
import { AcademicModule } from "./industries/education-and-courses/layanan-akademik/academic.module";
import { SocialCommerceIntelligenceModule } from "./industries/ecommerce-and-marketplaces/social-commerce-intelligence/social-commerce-intelligence.module";

const sharedModules = [SecurityModule, PrismaModule, AuthModule, StorageModule];
const coreModules = [CatalogModule, NotificationsModule, BillingModule, SettingsModule, PortalModule, CheckoutModule, AdminCustomersModule, TenantAccessModule];
const legacyOnlyModules = [ChurchModule, ClinicOpsModule, LmsModule, KknModule, AcademicModule, SocialCommerceIntelligenceModule];

function scopedModules() {
  const serviceScope: string = "cafe";

  switch (serviceScope) {
    case "core":
      return [...sharedModules, ...coreModules];
    case "hris":
      return [...sharedModules, NotificationsModule, HrisModule];
    case "cafe":
      return [...sharedModules, NotificationsModule, FnbModule];
    default:
      return [...sharedModules, ...coreModules, HrisModule, FnbModule, ...legacyOnlyModules];
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 100 }]),
    JwtModule.register({ global: true }),
    ...scopedModules()
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class ServiceAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
