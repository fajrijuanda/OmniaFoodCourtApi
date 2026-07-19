import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class SimulateAdvancedPayrollDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  gross?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  workDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  paidDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  customDeduction?: number;
}

export class UpdatePayrollComponentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(["Earning", "Deduction"])
  type?: "Earning" | "Deduction";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  amount?: number;
}
