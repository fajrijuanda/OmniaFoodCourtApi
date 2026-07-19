import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

class CreateOrderItemDto {
  @IsString()
  @MaxLength(80)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Max(1000000000)
  priceAtSale!: number;

  @IsOptional()
  variantSnapshot?: unknown;

  @IsOptional()
  modifiersSnapshot?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateOrderDto {
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  totalAmount!: number;

  @IsIn(["CASH", "QRIS", "E_WALLET", "DEBIT", "TRANSFER"])
  paymentMethod!: "CASH" | "QRIS" | "E_WALLET" | "DEBIT" | "TRANSFER";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  cashReceived?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  changeAmount?: number;

  @IsOptional()
  @IsString()
  orderType?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  reservationTime?: string;

  @IsOptional()
  @IsInt()
  pax?: number;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  dpAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
