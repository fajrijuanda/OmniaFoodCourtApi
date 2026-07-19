import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { BillingService, BillingTierName, PaymentMethod } from "./billing.service";

class UpgradeTierDto {
  @IsIn(["starter", "growth", "pro", "enterprise"])
  tier!: BillingTierName;
}

class CreatePaymentDto {
  @IsIn(["starter", "growth", "pro", "enterprise"])
  tier!: BillingTierName;

  @IsIn(["card", "qris", "bank_transfer"])
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  providerReference?: string;
}

class ConfirmPaymentDto {
  @IsString()
  paymentId!: string;
}

class CreateBillingCheckoutDto {
  @IsIn(["add_app", "upgrade", "renew"])
  checkoutType!: "add_app" | "upgrade" | "renew";

  @IsIn(["card", "qris", "bank_transfer"])
  method!: PaymentMethod;

  @IsString()
  industryName!: string;

  @IsString()
  segmentName!: string;

  @IsString()
  tierName!: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(100000000)
  amount?: number;
}

class CreateAddOnCheckoutDto {
  @IsString()
  addOnId!: string;

  @IsIn(["card", "qris", "bank_transfer"])
  method!: PaymentMethod;
}

@Controller("billing")
@UseGuards(AuthGuard("jwt"))
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("summary")
  summary(@Req() req: any) {
    return this.billing.getSummary(req.user);
  }

  @Post("upgrade")
  upgrade(@Req() req: any, @Body() body: UpgradeTierDto) {
    return this.billing.upgradeTier(req.user, body.tier);
  }

  @Post("payments")
  createPayment(@Req() req: any, @Body() body: CreatePaymentDto) {
    return this.billing.createPaymentIntent(req.user, body);
  }

  @Post("checkout")
  createCheckout(@Req() req: any, @Body() body: CreateBillingCheckoutDto) {
    return this.billing.createCheckout(req.user, body);
  }

  @Get("add-ons")
  addOns(@Req() req: any) {
    return this.billing.listAddOns(req.user);
  }

  @Post("add-ons/checkout")
  createAddOnCheckout(@Req() req: any, @Body() body: CreateAddOnCheckoutDto) {
    return this.billing.createAddOnCheckout(req.user, body);
  }

  @Post("payments/confirm")
  confirmPayment(@Req() req: any, @Body() body: ConfirmPaymentDto) {
    return this.billing.confirmPayment(req.user, body.paymentId);
  }
}
