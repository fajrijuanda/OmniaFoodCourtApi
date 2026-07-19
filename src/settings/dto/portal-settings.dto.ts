import { Type } from "class-transformer";
import { IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

class TenantSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  name?: string;
}

export class UpdatePortalSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TenantSettingsDto)
  tenant?: TenantSettingsDto;
}
