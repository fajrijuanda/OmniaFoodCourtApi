import { Body, Controller, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request as ExpressRequest } from "express";
import { getRequestMeta } from "../../../common/request-meta";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { PermissionGuard } from "../../../common/guards/permission.guard";
import { LmsService } from "./lms.service";

@Controller("tenant/lms")
@UseGuards(AuthGuard("jwt"), PermissionGuard)
export class LmsController {
  constructor(private readonly service: LmsService) {}

  // ── Dashboard ──────────────────────────────────────────────
  @Get("dashboard")
  @RequirePermission("campus.dashboard.read")
  dashboard(@Request() request: { user: any }) {
    return this.service.dashboard(request.user);
  }

  // ── Faculties ──────────────────────────────────────────────
  @Get("faculties")
  @RequirePermission("campus.faculty.read")
  faculties(@Request() request: { user: any }) {
    return this.service.listFaculties(request.user);
  }

  @Post("faculties")
  @RequirePermission("campus.faculty.write")
  createFaculty(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createFaculty(request.user, body, getRequestMeta(req));
  }

  @Patch("faculties/:id")
  @RequirePermission("campus.faculty.write")
  updateFaculty(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateFaculty(request.user, id, body, getRequestMeta(req));
  }

  // ── Study Programs ─────────────────────────────────────────
  @Get("study-programs")
  @RequirePermission("campus.program.read")
  studyPrograms(@Request() request: { user: any }) {
    return this.service.listStudyPrograms(request.user);
  }

  @Post("study-programs")
  @RequirePermission("campus.program.write")
  createStudyProgram(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createStudyProgram(request.user, body, getRequestMeta(req));
  }

  @Patch("study-programs/:id")
  @RequirePermission("campus.program.write")
  updateStudyProgram(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateStudyProgram(request.user, id, body, getRequestMeta(req));
  }

  // ── Students ───────────────────────────────────────────────
  @Get("students")
  @RequirePermission("campus.student.read")
  students(@Request() request: { user: any }, @Query("search") search?: string) {
    return this.service.listStudents(request.user, search);
  }

  @Post("students")
  @RequirePermission("campus.student.write")
  createStudent(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createStudent(request.user, body, getRequestMeta(req));
  }

  @Patch("students/:id")
  @RequirePermission("campus.student.write")
  updateStudent(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateStudent(request.user, id, body, getRequestMeta(req));
  }

  // ── Courses ────────────────────────────────────────────────
  @Get("courses")
  @RequirePermission("campus.course.read")
  courses(@Request() request: { user: any }) {
    return this.service.listCourses(request.user);
  }

  @Post("courses")
  @RequirePermission("campus.course.write")
  createCourse(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createCourse(request.user, body, getRequestMeta(req));
  }

  @Patch("courses/:id")
  @RequirePermission("campus.course.write")
  updateCourse(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateCourse(request.user, id, body, getRequestMeta(req));
  }

  // ── Classes ────────────────────────────────────────────────
  @Get("classes")
  @RequirePermission("campus.class.read")
  classes(@Request() request: { user: any }) {
    return this.service.listClasses(request.user);
  }

  @Post("classes")
  @RequirePermission("campus.class.write")
  createClass(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createClass(request.user, body, getRequestMeta(req));
  }

  @Patch("classes/:id")
  @RequirePermission("campus.class.write")
  updateClass(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateClass(request.user, id, body, getRequestMeta(req));
  }

  // ── Enrollments ────────────────────────────────────────────
  @Get("enrollments")
  @RequirePermission("campus.enrollment.read")
  enrollments(@Request() request: { user: any }, @Query("classId") classId?: string) {
    return this.service.listEnrollments(request.user, classId);
  }

  @Post("enrollments")
  @RequirePermission("campus.enrollment.write")
  createEnrollment(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createEnrollment(request.user, body, getRequestMeta(req));
  }

  // ── Assignments ────────────────────────────────────────────
  @Get("assignments")
  @RequirePermission("campus.assignment.read")
  assignments(@Request() request: { user: any }, @Query("classId") classId?: string) {
    return this.service.listAssignments(request.user, classId);
  }

  @Post("assignments")
  @RequirePermission("campus.assignment.write")
  createAssignment(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createAssignment(request.user, body, getRequestMeta(req));
  }

  @Patch("assignments/:id")
  @RequirePermission("campus.assignment.write")
  updateAssignment(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateAssignment(request.user, id, body, getRequestMeta(req));
  }

  // ── Submissions ────────────────────────────────────────────
  @Get("submissions")
  @RequirePermission("campus.submission.read")
  submissions(@Request() request: { user: any }, @Query("assignmentId") assignmentId?: string) {
    return this.service.listSubmissions(request.user, assignmentId);
  }

  @Post("submissions")
  @RequirePermission("campus.submission.write")
  createSubmission(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createSubmission(request.user, body, getRequestMeta(req));
  }

  @Patch("submissions/:id")
  @RequirePermission("campus.submission.write")
  gradeSubmission(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.gradeSubmission(request.user, id, body, getRequestMeta(req));
  }

  // ── Attendance ─────────────────────────────────────────────
  @Get("attendance")
  @RequirePermission("campus.attendance.read")
  attendance(@Request() request: { user: any }, @Query("classId") classId?: string) {
    return this.service.listAttendance(request.user, classId);
  }

  @Post("attendance")
  @RequirePermission("campus.attendance.write")
  createAttendance(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createAttendance(request.user, body, getRequestMeta(req));
  }

  // ── Grades ─────────────────────────────────────────────────
  @Get("grades")
  @RequirePermission("campus.grade.read")
  grades(@Request() request: { user: any }, @Query("classId") classId?: string) {
    return this.service.listGrades(request.user, classId);
  }

  @Post("grades")
  @RequirePermission("campus.grade.write")
  createGrade(@Request() request: { user: any }, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.createGrade(request.user, body, getRequestMeta(req));
  }

  @Patch("grades/:id")
  @RequirePermission("campus.grade.write")
  updateGrade(@Request() request: { user: any }, @Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: ExpressRequest) {
    return this.service.updateGrade(request.user, id, body, getRequestMeta(req));
  }

  // ── Analytics ──────────────────────────────────────────────
  @Get("analytics")
  @RequirePermission("campus.analytics.read")
  analytics(@Request() request: { user: any }) {
    return this.service.analytics(request.user);
  }

}
