import { Module } from '@nestjs/common';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { HrisOperationsController } from './non-mvp-operations/operations.controller';
import { HrisOperationsService } from './non-mvp-operations/operations.service';
import { HrisSettingsController } from './settings/settings.controller';
import { HrisSettingsService } from './settings/settings.service';
import { LoansController } from './loans/loans.controller';
import { LoansService } from './loans/loans.service';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    EmployeesController,
    AttendanceController,
    LeaveController,
    PayrollController,
    HrisOperationsController,
    HrisSettingsController,
    LoansController
  ],
  providers: [
    EmployeesService,
    AttendanceService,
    LeaveService,
    PayrollService,
    HrisOperationsService,
    HrisSettingsService,
    LoansService
  ],
})
export class HrisModule {}
