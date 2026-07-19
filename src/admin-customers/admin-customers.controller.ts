import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsOptional, IsString } from "class-validator";
import { SuperAdminGuard } from "../auth/roles.guard";
import { AdminCustomersService } from "./admin-customers.service";

class UpdateFollowUpDto {
  @IsOptional()
  @IsString()
  followUpStatus?: string;

  @IsOptional()
  @IsString()
  followUpNotes?: string;
}

@UseGuards(AuthGuard("jwt"), SuperAdminGuard)
@Controller("admin/customers")
export class AdminCustomersController {
  constructor(private readonly adminCustomers: AdminCustomersService) {}

  @Get("overview")
  overview() {
    return this.adminCustomers.overview();
  }

  @Get("accounts")
  accounts() {
    return this.adminCustomers.accounts();
  }

  @Get("transactions")
  transactions() {
    return this.adminCustomers.transactions();
  }

  @Get("follow-ups")
  followUps() {
    return this.adminCustomers.followUps();
  }

  @Patch("follow-ups/:id")
  updateFollowUp(@Param("id") id: string, @Body() body: UpdateFollowUpDto) {
    return this.adminCustomers.updateFollowUp(id, body);
  }
}
