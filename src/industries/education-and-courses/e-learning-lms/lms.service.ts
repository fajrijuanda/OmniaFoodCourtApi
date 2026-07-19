import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

type LmsTier = "starter" | "growth" | "pro" | "enterprise";
type LmsContext = {
  tenantId: string;
  branchId?: string | null;
  branchScope: "single" | "all";
  userId?: string | null;
};
type AuditMeta = { ip?: string; userAgent?: string };

const TIER_RANK: Record<LmsTier, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4
};

@Injectable()
export class LmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard ──────────────────────────────────────────────

  async dashboard(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const where = this.branchWhere(context);

    const [students, classes, pendingApprovals, activeKknGroups, announcements] = await Promise.all([
      this.prisma.campusStudent.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusClass.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusApproval.count({ where: { tenantId: context.tenantId, ...where, status: "pending" } }),
      this.prisma.campusKknGroup.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusAnnouncement.findMany({
        where: { tenantId: context.tenantId, ...where },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    return {
      tier: await this.activeTier(context),
      stats: { students, classes, pendingApprovals, activeKknGroups },
      announcements
    };
  }

  // ── Faculties ──────────────────────────────────────────────

  async listFaculties(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusFaculty.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { name: "asc" },
      include: { studyPrograms: { where: { isActive: true }, orderBy: { name: "asc" } } }
    });
  }

  async createFaculty(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const faculty = await this.prisma.campusFaculty.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        name: this.required(body.name, "Nama fakultas wajib diisi."),
        code: this.string(body.code),
        deanName: this.string(body.deanName)
      }
    });
    await this.audit(context, "campus.faculty.create", "campus", "CampusFaculty", faculty.id, null, faculty, meta);
    return faculty;
  }

  async updateFaculty(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusFaculty.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Fakultas tidak ditemukan.");
    const after = await this.prisma.campusFaculty.update({
      where: { id },
      data: {
        name: this.string(body.name) ?? before.name,
        code: this.string(body.code) ?? before.code,
        deanName: this.string(body.deanName) ?? before.deanName,
        isActive: this.boolean(body.isActive) ?? before.isActive
      }
    });
    await this.audit(context, "campus.faculty.update", "campus", "CampusFaculty", id, before, after, meta);
    return after;
  }

  // ── Study Programs ─────────────────────────────────────────

  async listStudyPrograms(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusStudyProgram.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { name: "asc" },
      include: { faculty: true }
    });
  }

  async createStudyProgram(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const program = await this.prisma.campusStudyProgram.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        facultyId: this.required(body.facultyId, "Fakultas wajib dipilih."),
        name: this.required(body.name, "Nama prodi wajib diisi."),
        code: this.string(body.code),
        degree: this.string(body.degree),
        headName: this.string(body.headName)
      }
    });
    await this.audit(context, "campus.program.create", "campus", "CampusStudyProgram", program.id, null, program, meta);
    return program;
  }

  async updateStudyProgram(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusStudyProgram.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Program studi tidak ditemukan.");
    const after = await this.prisma.campusStudyProgram.update({
      where: { id },
      data: {
        name: this.string(body.name) ?? before.name,
        code: this.string(body.code) ?? before.code,
        degree: this.string(body.degree) ?? before.degree,
        headName: this.string(body.headName) ?? before.headName,
        isActive: this.boolean(body.isActive) ?? before.isActive
      }
    });
    await this.audit(context, "campus.program.update", "campus", "CampusStudyProgram", id, before, after, meta);
    return after;
  }

  // ── Students ───────────────────────────────────────────────

  async listStudents(user: any, search?: string) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusStudent.findMany({
      where: {
        tenantId: context.tenantId,
        ...this.branchWhere(context),
        ...(search ? { OR: [{ fullName: { contains: search, mode: "insensitive" as any } }, { nim: { contains: search, mode: "insensitive" as any } }] } : {})
      },
      orderBy: { fullName: "asc" },
      include: { studyProgram: { include: { faculty: true } } },
      take: 100
    });
  }

  async createStudent(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const student = await this.prisma.campusStudent.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        studyProgramId: this.string(body.studyProgramId),
        nim: this.required(body.nim, "NIM wajib diisi."),
        fullName: this.required(body.fullName, "Nama mahasiswa wajib diisi."),
        email: this.string(body.email),
        phoneNumber: this.string(body.phoneNumber),
        gender: this.string(body.gender),
        entryYear: this.integer(body.entryYear),
        currentSemester: this.integer(body.currentSemester)
      }
    });
    await this.audit(context, "campus.student.create", "campus", "CampusStudent", student.id, null, student, meta);
    return student;
  }

  async updateStudent(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusStudent.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Mahasiswa tidak ditemukan.");
    const after = await this.prisma.campusStudent.update({
      where: { id },
      data: {
        fullName: this.string(body.fullName) ?? before.fullName,
        email: this.string(body.email) ?? before.email,
        phoneNumber: this.string(body.phoneNumber) ?? before.phoneNumber,
        gender: this.string(body.gender) ?? before.gender,
        currentSemester: this.integer(body.currentSemester) ?? before.currentSemester,
        status: this.string(body.status) ?? before.status
      }
    });
    await this.audit(context, "campus.student.update", "campus", "CampusStudent", id, before, after, meta);
    return after;
  }

  // ── Courses ────────────────────────────────────────────────

  async listCourses(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusCourse.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { name: "asc" },
      include: { studyProgram: true, faculty: true, classes: { where: { status: "active" } } }
    });
  }

  async createCourse(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const course = await this.prisma.campusCourse.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        studyProgramId: this.string(body.studyProgramId),
        facultyId: this.string(body.facultyId),
        code: this.string(body.code),
        name: this.required(body.name, "Nama mata kuliah wajib diisi."),
        credits: this.integer(body.credits) ?? 3,
        semester: this.integer(body.semester),
        lecturerName: this.string(body.lecturerName),
        description: this.string(body.description)
      }
    });
    await this.audit(context, "campus.course.create", "campus", "CampusCourse", course.id, null, course, meta);
    return course;
  }

  async updateCourse(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusCourse.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Mata kuliah tidak ditemukan.");
    const after = await this.prisma.campusCourse.update({
      where: { id },
      data: {
        name: this.string(body.name) ?? before.name,
        code: this.string(body.code) ?? before.code,
        credits: this.integer(body.credits) ?? before.credits,
        semester: this.integer(body.semester) ?? before.semester,
        lecturerName: this.string(body.lecturerName) ?? before.lecturerName,
        description: this.string(body.description) ?? before.description,
        isActive: this.boolean(body.isActive) ?? before.isActive
      }
    });
    await this.audit(context, "campus.course.update", "campus", "CampusCourse", id, before, after, meta);
    return after;
  }

  // ── Classes ────────────────────────────────────────────────

  async listClasses(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusClass.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context) },
      orderBy: { createdAt: "desc" },
      include: { course: true, studyProgram: true, _count: { select: { enrollments: true } } },
      take: 100
    });
  }

  async createClass(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const cls = await this.prisma.campusClass.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        courseId: this.required(body.courseId, "Mata kuliah wajib dipilih."),
        studyProgramId: this.string(body.studyProgramId),
        name: this.required(body.name, "Nama kelas wajib diisi."),
        academicYear: this.string(body.academicYear),
        semester: this.string(body.semester),
        schedule: this.string(body.schedule),
        room: this.string(body.room),
        lecturerName: this.string(body.lecturerName),
        capacity: this.integer(body.capacity) ?? 40
      }
    });
    await this.audit(context, "campus.class.create", "campus", "CampusClass", cls.id, null, cls, meta);
    return cls;
  }

  async updateClass(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusClass.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Kelas tidak ditemukan.");
    const after = await this.prisma.campusClass.update({
      where: { id },
      data: {
        name: this.string(body.name) ?? before.name,
        schedule: this.string(body.schedule) ?? before.schedule,
        room: this.string(body.room) ?? before.room,
        lecturerName: this.string(body.lecturerName) ?? before.lecturerName,
        capacity: this.integer(body.capacity) ?? before.capacity,
        status: this.string(body.status) ?? before.status
      }
    });
    await this.audit(context, "campus.class.update", "campus", "CampusClass", id, before, after, meta);
    return after;
  }

  // ── Enrollments ────────────────────────────────────────────

  async listEnrollments(user: any, classId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusEnrollment.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(classId ? { classId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { student: true, class: { include: { course: true } } },
      take: 100
    });
  }

  async createEnrollment(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const enrollment = await this.prisma.campusEnrollment.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        classId: this.required(body.classId, "Kelas wajib dipilih."),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        status: this.string(body.status) ?? "enrolled"
      }
    });
    await this.audit(context, "campus.enrollment.create", "campus", "CampusEnrollment", enrollment.id, null, enrollment, meta);
    return enrollment;
  }

  // ── Assignments ────────────────────────────────────────────

  async listAssignments(user: any, classId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusAssignment.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(classId ? { classId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { class: { include: { course: true } }, _count: { select: { submissions: true } } },
      take: 100
    });
  }

  async createAssignment(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const assignment = await this.prisma.campusAssignment.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        classId: this.required(body.classId, "Kelas wajib dipilih."),
        title: this.required(body.title, "Judul tugas wajib diisi."),
        description: this.string(body.description),
        dueDate: this.date(body.dueDate),
        maxScore: this.decimal(body.maxScore) ?? 100,
        weight: this.decimal(body.weight) ?? 1,
        status: this.string(body.status) ?? "published"
      }
    });
    await this.audit(context, "campus.assignment.create", "campus", "CampusAssignment", assignment.id, null, assignment, meta);
    return assignment;
  }

  async updateAssignment(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusAssignment.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Tugas tidak ditemukan.");
    const after = await this.prisma.campusAssignment.update({
      where: { id },
      data: {
        title: this.string(body.title) ?? before.title,
        description: this.string(body.description) ?? before.description,
        dueDate: body.dueDate === undefined ? before.dueDate : this.date(body.dueDate),
        status: this.string(body.status) ?? before.status
      }
    });
    await this.audit(context, "campus.assignment.update", "campus", "CampusAssignment", id, before, after, meta);
    return after;
  }

  // ── Submissions ────────────────────────────────────────────

  async listSubmissions(user: any, assignmentId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    return this.prisma.campusSubmission.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(assignmentId ? { assignmentId } : {}) },
      orderBy: { submittedAt: "desc" },
      include: { student: true, assignment: true },
      take: 100
    });
  }

  async createSubmission(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const submission = await this.prisma.campusSubmission.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        assignmentId: this.required(body.assignmentId, "Tugas wajib dipilih."),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        content: this.string(body.content),
        fileUrl: this.string(body.fileUrl)
      }
    });
    await this.audit(context, "campus.submission.create", "campus", "CampusSubmission", submission.id, null, submission, meta);
    return submission;
  }

  async gradeSubmission(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "starter");
    const before = await this.prisma.campusSubmission.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Submission tidak ditemukan.");
    const after = await this.prisma.campusSubmission.update({
      where: { id },
      data: {
        score: this.decimal(body.score),
        feedback: this.string(body.feedback),
        status: "graded",
        gradedAt: new Date()
      }
    });
    await this.audit(context, "campus.submission.grade", "campus", "CampusSubmission", id, before, after, meta);
    return after;
  }

  // ── Attendance ─────────────────────────────────────────────

  async listAttendance(user: any, classId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.campusAttendance.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(classId ? { classId } : {}) },
      orderBy: { date: "desc" },
      include: { student: true, class: { include: { course: true } } },
      take: 200
    });
  }

  async createAttendance(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const attendance = await this.prisma.campusAttendance.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        classId: this.required(body.classId, "Kelas wajib dipilih."),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        meetingNo: this.integer(body.meetingNo) ?? 1,
        date: this.date(body.date) ?? new Date(),
        status: this.string(body.status) ?? "present",
        notes: this.string(body.notes)
      }
    });
    await this.audit(context, "campus.attendance.create", "campus", "CampusAttendance", attendance.id, null, attendance, meta);
    return attendance;
  }

  // ── Grades ─────────────────────────────────────────────────

  async listGrades(user: any, classId?: string) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    return this.prisma.campusGrade.findMany({
      where: { tenantId: context.tenantId, ...this.branchWhere(context), ...(classId ? { classId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { student: true, class: { include: { course: true } } },
      take: 100
    });
  }

  async createGrade(user: any, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const grade = await this.prisma.campusGrade.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? await this.defaultBranchId(context.tenantId),
        classId: this.required(body.classId, "Kelas wajib dipilih."),
        studentId: this.required(body.studentId, "Mahasiswa wajib dipilih."),
        midterm: this.decimal(body.midterm),
        finalExam: this.decimal(body.finalExam),
        assignment: this.decimal(body.assignment),
        total: this.decimal(body.total),
        letter: this.string(body.letter)
      }
    });
    await this.audit(context, "campus.grade.create", "campus", "CampusGrade", grade.id, null, grade, meta);
    return grade;
  }

  async updateGrade(user: any, id: string, body: Record<string, unknown>, meta?: AuditMeta) {
    const context = this.context(user);
    await this.requireTier(context, "growth");
    const before = await this.prisma.campusGrade.findFirst({ where: { id, tenantId: context.tenantId } });
    if (!before) throw new NotFoundException("Nilai tidak ditemukan.");
    const after = await this.prisma.campusGrade.update({
      where: { id },
      data: {
        midterm: body.midterm === undefined ? before.midterm : this.decimal(body.midterm),
        finalExam: body.finalExam === undefined ? before.finalExam : this.decimal(body.finalExam),
        assignment: body.assignment === undefined ? before.assignment : this.decimal(body.assignment),
        total: body.total === undefined ? before.total : this.decimal(body.total),
        letter: this.string(body.letter) ?? before.letter,
        status: this.string(body.status) ?? before.status
      }
    });
    await this.audit(context, "campus.grade.update", "campus", "CampusGrade", id, before, after, meta);
    return after;
  }

  // ── Analytics ──────────────────────────────────────────────

  async analytics(user: any) {
    const context = this.context(user);
    await this.requireTier(context, "pro");
    const where = this.branchWhere(context);

    const [students, activeClasses, pendingApprovals, kknGroups, submissions, invoicePaid] = await Promise.all([
      this.prisma.campusStudent.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusClass.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusApproval.count({ where: { tenantId: context.tenantId, ...where, status: "pending" } }),
      this.prisma.campusKknGroup.count({ where: { tenantId: context.tenantId, ...where, status: "active" } }),
      this.prisma.campusSubmission.count({ where: { tenantId: context.tenantId, ...where, status: "submitted" } }),
      this.prisma.campusPayment.aggregate({
        where: { tenantId: context.tenantId, ...where, status: "paid" },
        _sum: { amount: true },
        _count: true
      })
    ]);

    return {
      students,
      activeClasses,
      pendingApprovals,
      kknGroups,
      pendingSubmissions: submissions,
      revenue: Number(invoicePaid._sum.amount ?? 0),
      paymentCount: invoicePaid._count
    };
  }

  // ── Private helpers ────────────────────────────────────────

  private context(user: any): LmsContext {
    const tenantId = user?.activeTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException("Tenant context missing.");
    return {
      tenantId,
      branchId: user?.branchScope === "all" ? undefined : user?.activeBranchId ?? user?.branchId ?? undefined,
      branchScope: user?.branchScope === "all" ? "all" : "single",
      userId: user?.id ?? null
    };
  }

  private branchWhere(context: LmsContext) {
    return context.branchScope === "all" ? {} : { branchId: context.branchId ?? null };
  }

  private async activeTier(context: LmsContext): Promise<LmsTier> {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId: context.tenantId,
        status: { in: ["active", "trial", "subscribed"] },
        OR: [
          { subIndustry: { slug: { contains: "higher-education", mode: "insensitive" } } },
          { subIndustry: { name: { contains: "Higher Education", mode: "insensitive" } } },
          { subIndustry: { name: { contains: "Campus", mode: "insensitive" } } },
          { subIndustry: { industry: { slug: { contains: "pendidikan", mode: "insensitive" } } } }
        ]
      },
      include: { tier: true },
      orderBy: { createdAt: "desc" }
    });
    const raw = `${subscription?.tier?.slug ?? ""} ${subscription?.tier?.name ?? ""}`.toLowerCase();
    if (raw.includes("enterprise")) return "enterprise";
    if (raw.includes("pro") || raw.includes("business")) return "pro";
    if (raw.includes("growth")) return "growth";
    if (raw.includes("starter")) return "starter";
    return "starter";
  }

  private async requireTier(context: LmsContext, minimum: LmsTier) {
    const active = await this.activeTier(context);
    if (TIER_RANK[active] < TIER_RANK[minimum]) {
      throw new ForbiddenException(`Campus ${minimum} tier required.`);
    }
  }

  private async audit(context: LmsContext, action: string, module: string, entityType?: string, entityId?: string | null, before?: unknown, after?: unknown, meta?: AuditMeta) {
    return this.prisma.tenantAuditLog.create({
      data: {
        tenantId: context.tenantId,
        branchId: context.branchId ?? null,
        actorUserId: context.userId ?? null,
        action,
        module,
        entityType,
        entityId: entityId ?? null,
        before: before === undefined ? undefined : before as Prisma.InputJsonValue,
        after: after === undefined ? undefined : after as Prisma.InputJsonValue,
        ip: meta?.ip,
        userAgent: meta?.userAgent?.slice(0, 240)
      }
    });
  }

  private async defaultBranchId(tenantId: string) {
    const branch = await this.prisma.tenantBranch.findFirst({ where: { tenantId, status: "active" }, orderBy: { createdAt: "asc" } });
    if (!branch) throw new BadRequestException("Tenant belum memiliki cabang aktif.");
    return branch.id;
  }

  private required(value: unknown, message: string): string {
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) throw new BadRequestException(message);
    return str;
  }

  private string(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  private integer(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return parseInt(value.trim(), 10);
    return undefined;
  }

  private decimal(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") { const num = parseFloat(value); if (Number.isFinite(num)) return num; }
    return 0;
  }

  private date(value: unknown): Date | undefined {
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim()) { const d = new Date(value); if (!isNaN(d.getTime())) return d; }
    return undefined;
  }

  private boolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    return undefined;
  }
}
