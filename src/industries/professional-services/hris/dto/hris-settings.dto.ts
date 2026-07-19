import { IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';

export class UpdateHrisSettingsDto {
  @IsOptional() @IsNumber() maxLateMinutes?: number;
  @IsOptional() @IsBoolean() requirePhotoForAttendance?: boolean;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsBoolean() autoDeductLeaveForLate?: boolean;
}
