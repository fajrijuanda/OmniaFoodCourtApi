import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() requirePinForDiscount?: boolean;
  @IsOptional() @IsBoolean() printReceiptAutomatically?: boolean;
}

export class CreateTableDto {
  @IsString() name!: string;
  @IsOptional() @IsNumber() capacity?: number;
}

export class UpdateTableDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() capacity?: number;
}

export class CreateReservationDto {
  @IsString() customerName!: string;
  @IsString() customerPhone!: string;
  @IsString() reservationTime!: string;
  @IsNumber() pax!: number;
  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateReservationStatusDto {
  @IsString() status!: string;
}

export class CreateIngredientDto {
  @IsString() name!: string;
  @IsString() unit!: string;
  @IsOptional() @IsNumber() currentStock?: number;
  @IsOptional() @IsNumber() minStockAlert?: number;
}

export class UpdateIngredientDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() currentStock?: number;
  @IsOptional() @IsNumber() minStockAlert?: number;
}

export class MarkOrderAsPaidDto {
  @IsOptional() @IsNumber() cashReceived?: number;
}

export class OpenShiftDto {
  @IsNumber() startingCash!: number;
}

export class CloseShiftDto {
  @IsNumber() actualEndingCash!: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateStockAdjustmentDto {
  @IsString() ingredientId!: string;
  @IsNumber() quantity!: number;
  @IsString() type!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateKitchenOrderStatusDto {
  @IsString() status!: string;
}

export class CreateCategoryDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() icon?: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() icon?: string;
}

export class CreatePromoBannerDto {
  @IsString() title!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsString() targetUrl?: string;
}

export class UpdatePromoBannerDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() targetUrl?: string;
}

export class CreateProductDto {
  @IsString() name!: string;
  @IsString() description!: string;
  @IsNumber() price!: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class UpdateFollowUpStatusDto {
  @IsString() status!: string;
}
