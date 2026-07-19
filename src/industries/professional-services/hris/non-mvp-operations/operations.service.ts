import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { StorageService } from '../../../../storage/storage.service';

@Injectable()
export class HrisOperationsService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async getDashboard(tenantId: string, branchId?: string | null) {
    const branchWhere = branchId ? { branchId } : {};
    const [employees, attendance, leave, payroll, reimbursements, fieldReports, kpis, jobs] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, status: 'active', ...branchWhere } }),
      this.prisma.attendanceLog.count({ where: { tenantId, clockInAt: { gte: this.startOfToday() }, ...branchWhere } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'Pending', ...branchWhere } }),
      this.prisma.payrollRun.findFirst({ where: { tenantId, ...branchWhere }, orderBy: { createdAt: 'desc' } }),
      this.prisma.reimbursementRequest.count({ where: { tenantId, status: 'Pending', ...branchWhere } }),
      this.prisma.fieldReport.count({ where: { tenantId, date: { gte: this.startOfToday() }, ...branchWhere } }),
      this.prisma.performanceKpi.count({ where: { tenantId, status: { in: ['Draft', 'Active'] }, ...branchWhere } }),
      this.prisma.jobPosting.count({ where: { tenantId, status: 'Open', ...branchWhere } })
    ]);

    return {
      employees,
      attendanceToday: attendance,
      pendingLeave: leave,
      pendingReimbursements: reimbursements,
      fieldReportsToday: fieldReports,
      activeKpis: kpis,
      openJobs: jobs,
      latestPayroll: payroll
    };
  }

  async exportDashboard(tenantId: string, format: 'pdf' | 'excel' = 'excel', branchId?: string | null) {
    const summary = await this.getDashboard(tenantId, branchId);
    const rows = Object.entries(summary).map(([key, value]) => `${key},${JSON.stringify(value)}`).join('\n');
    const content = `Metric,Value\n${rows}`;
    return {
      filename: `omnia-hris-dashboard.${format === 'pdf' ? 'html' : 'csv'}`,
      mimeType: format === 'pdf' ? 'text/html' : 'text/csv',
      content: Buffer.from(format === 'pdf' ? `<pre>${this.escapeHtml(content)}</pre>` : content, 'utf8').toString('base64')
    };
  }

  async listReimbursements(tenantId: string, branchId?: string | null) {
    return this.prisma.reimbursementRequest.findMany({ where: { tenantId, ...(branchId ? { branchId } : {}) }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
  }

  async createReimbursement(tenantId: string, data: any, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, data.employeeId, branchId);
    const ocr = this.parseReceipt(data.receiptUrl ?? data.receiptText ?? '');
    
    let localReceiptUrl = data.receiptUrl;
    if (localReceiptUrl) {
      localReceiptUrl = await this.storage.saveBase64Image(localReceiptUrl, 'hris/reimbursement');
    }

    return this.prisma.reimbursementRequest.create({
      data: {
        tenantId,
        branchId: branchId ?? employee.branchId ?? null,
        employeeId: employee.id,
        date: data.date ? new Date(data.date) : new Date(),
        type: data.type ?? ocr.type,
        amount: Number(data.amount ?? ocr.amount ?? 0),
        receiptUrl: localReceiptUrl,
        notes: data.notes ?? ocr.notes,
        status: 'Pending'
      },
      include: { employee: true }
    });
  }

  async updateReimbursementStatus(tenantId: string, id: string, status: string) {
    return this.prisma.reimbursementRequest.update({ where: { id, tenantId }, data: { status } });
  }

  async listFieldReports(tenantId: string, branchId?: string | null) {
    return this.prisma.fieldReport.findMany({ where: { tenantId, ...(branchId ? { branchId } : {}) }, include: { employee: true }, orderBy: { date: 'desc' } });
  }

  async createFieldReport(tenantId: string, data: any, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, data.employeeId, branchId);
    
    let localPhotoUrl = data.photoUrl;
    if (localPhotoUrl) {
      localPhotoUrl = await this.storage.saveBase64Image(localPhotoUrl, 'hris/field-report');
    }

    return this.prisma.fieldReport.create({
      data: {
        tenantId,
        branchId: branchId ?? employee.branchId ?? null,
        employeeId: employee.id,
        date: data.date ? new Date(data.date) : new Date(),
        checkInTime: data.checkInTime ? new Date(data.checkInTime) : new Date(),
        checkOutTime: data.checkOutTime ? new Date(data.checkOutTime) : null,
        locationName: data.locationName,
        latitude: data.latitude,
        longitude: data.longitude,
        photoUrl: localPhotoUrl,
        notes: data.notes
      },
      include: { employee: true }
    });
  }

  async listKpis(tenantId: string, branchId?: string | null) {
    return this.prisma.performanceKpi.findMany({ where: { tenantId, ...(branchId ? { branchId } : {}) }, include: { employee: true }, orderBy: { createdAt: 'desc' } });
  }

  async createKpi(tenantId: string, data: any, branchId?: string | null) {
    const employee = await this.resolveEmployee(tenantId, data.employeeId, branchId);
    const target = Number(data.targetValue ?? 0);
    const actual = Number(data.actualValue ?? 0);
    return this.prisma.performanceKpi.create({
      data: {
        tenantId,
        branchId: branchId ?? employee.branchId ?? null,
        employeeId: employee.id,
        period: data.period ?? 'Q2-2026',
        metricName: data.metricName,
        targetValue: target,
        actualValue: actual,
        score: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0,
        status: data.status ?? 'Active'
      },
      include: { employee: true }
    });
  }

  async listJobs(tenantId: string, branchId?: string | null) {
    return this.prisma.jobPosting.findMany({ where: { tenantId, ...(branchId ? { branchId } : {}) }, include: { jobApplicants: true }, orderBy: { createdAt: 'desc' } });
  }

  async createJob(tenantId: string, data: any, branchId?: string | null) {
    return this.prisma.jobPosting.create({
      data: {
        tenantId,
        branchId: branchId ?? null,
        title: data.title,
        employmentType: data.employmentType ?? 'Full-time',
        description: data.description,
        status: data.status ?? 'Open'
      },
      include: { jobApplicants: true }
    });
  }

  async createApplicant(tenantId: string, jobPostingId: string, data: any, branchId?: string | null) {
    const job = await this.prisma.jobPosting.findFirst({ where: { id: jobPostingId, tenantId, ...(branchId ? { branchId } : {}) } });
    if (!job) throw new NotFoundException('Job posting not found.');

    let localResumeUrl = data.resumeUrl;
    if (localResumeUrl) {
      localResumeUrl = await this.storage.saveBase64Image(localResumeUrl, 'hris/recruitment');
    }

    return this.prisma.jobApplicant.create({
      data: {
        tenantId,
        branchId: branchId ?? job.branchId ?? null,
        jobPostingId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        resumeUrl: localResumeUrl,
        status: 'New'
      }
    });
  }

  private async resolveEmployee(tenantId: string, employeeId?: string, branchId?: string | null) {
    const employee = employeeId
      ? await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId, ...(branchId ? { branchId } : {}) } })
      : await this.prisma.employee.findFirst({ where: { tenantId, status: 'active', ...(branchId ? { branchId } : {}) }, orderBy: { createdAt: 'asc' } });
    if (!employee) throw new BadRequestException('Employee profile not found.');
    return employee;
  }

  private parseReceipt(value: string) {
    const amountMatch = value.match(/(?:rp|idr)?\s*([0-9][0-9.,]{3,})/i);
    return {
      type: /travel|transport|grab|gojek|taxi/i.test(value) ? 'Travel' : 'General',
      amount: amountMatch ? Number(amountMatch[1].replace(/[.,]/g, '')) : 0,
      notes: value ? `OCR parsed receipt text: ${value.slice(0, 180)}` : undefined
    };
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private escapeHtml(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
