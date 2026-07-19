import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HrisModule } from './industries/professional-services/hris/hris.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FnbModule } from './industries/fnb/fnb.module';
import { BillingModule } from "./billing/billing.module";
import { ChurchModule } from "./industries/public-services/church/church.module";
import { ClinicOpsModule } from "./industries/healthcare/clinic/clinic-ops.module";
import { LmsModule } from "./industries/education-and-courses/e-learning-lms/lms.module";
import { KknModule } from "./industries/education-and-courses/kkn-and-fieldwork/kkn.module";
import { AcademicModule } from "./industries/education-and-courses/layanan-akademik/academic.module";
import { SocialCommerceIntelligenceModule } from "./industries/ecommerce-and-marketplaces/social-commerce-intelligence/social-commerce-intelligence.module";
import { SettingsModule } from "./settings/settings.module";
import { SecurityModule } from "./security/security.module";
import { PortalModule } from "./portal/portal.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { AdminCustomersModule } from "./admin-customers/admin-customers.module";
import { TenantAccessModule } from "./tenant/tenant-access.module";
import { StorageModule } from "./storage/storage.module";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      name: "default",
      ttl: 60000,
      limit: 100
    }]),
    JwtModule.register({ global: true }),
    SecurityModule,
    PrismaModule,
    AuthModule,
    CatalogModule,
    HrisModule,
    NotificationsModule,
    FnbModule,
    BillingModule,
    SettingsModule,
    ChurchModule,
    ClinicOpsModule,
    LmsModule,
    KknModule,
    AcademicModule,
    SocialCommerceIntelligenceModule,
    PortalModule,
    CheckoutModule,
    AdminCustomersModule,
    TenantAccessModule,
    StorageModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
