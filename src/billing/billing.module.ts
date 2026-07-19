import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { CheckoutModule } from "../checkout/checkout.module";

@Module({
  imports: [CheckoutModule],
  controllers: [BillingController],
  providers: [BillingService]
})
export class BillingModule {}
