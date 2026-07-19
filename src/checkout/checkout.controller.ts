import { Body, Controller, Headers, Post } from "@nestjs/common";
import { IsArray, IsEmail, IsIn, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CheckoutService, CheckoutPaymentMethod } from "./checkout.service";

class CheckoutItemDto {
  @IsOptional()
  @IsIn(["subscription", "addon"])
  itemType?: "subscription" | "addon";

  @IsOptional()
  @IsString()
  addOnId?: string;

  @IsString()
  industryName!: string;

  @IsString()
  segmentName!: string;

  @IsString()
  tierName!: string;

  @IsNumber()
  @Min(1000)
  @Max(100000000)
  amount!: number;
}

class CheckoutCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class CreateCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsOptional()
  @IsIn(["qris", "bank_transfer", "card"])
  method?: CheckoutPaymentMethod;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer?: CheckoutCustomerDto;

  @IsOptional()
  @IsIn(["landing", "portal"])
  source?: "landing" | "portal";

  @IsOptional()
  @IsIn(["new_subscription", "add_app", "upgrade", "renew"])
  checkoutType?: "new_subscription" | "add_app" | "upgrade" | "renew";
}

@Controller("public/checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  create(@Body() body: CreateCheckoutDto) {
    return this.checkout.createCheckout(body);
  }

  @Post("xendit-webhook")
  xenditWebhook(@Headers() headers: Record<string, any>, @Body() body: any) {
    return this.checkout.handleXenditWebhook(headers, body);
  }
}
