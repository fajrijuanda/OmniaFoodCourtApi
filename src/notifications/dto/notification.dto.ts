import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class NotificationQueryDto {
  @IsOptional()
  @IsIn(["unread", "read"])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}

export class CreateNotificationDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsString()
  @MaxLength(1000)
  body!: string;

  @IsString()
  @MaxLength(60)
  category!: string;

  @IsOptional()
  @IsIn(["high", "normal", "low"])
  priority?: string;

  @IsOptional()
  @Matches(/^(\/[a-zA-Z0-9/_?=&.-]*|https:\/\/[a-zA-Z0-9.-]+[a-zA-Z0-9/_?=&.%:-]*)$/)
  @MaxLength(500)
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  userId?: string;
}
