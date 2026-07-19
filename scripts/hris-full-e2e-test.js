const API_URL = process.env.SMOKE_API_URL || "http://127.0.0.1:4000/api";
const EMAIL = process.env.SMOKE_EMAIL || "owner@omnia.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Owner123!";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

function makeImageDataUrl(seed, size = 2048) {
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i += 1) {
    bytes[i] = (seed + i * 17 + Math.floor(i / 13)) % 256;
  }
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

async function main() {
  console.log("Starting HRIS Full E2E Test...");
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

  // 1. Authentication
  console.log("1. Testing Authentication...");
  const login = await request("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD }
  });
  const token = login.accessToken;
  assert(token, "Login did not return accessToken.");

  const me = await request("/auth/me", { token });
  assert(me.email, "Auth session is missing user email.");
  console.log("   ✅ Auth successful");

  // 2. Employee Management
  console.log("2. Testing Employee Management...");
  const employee = await request("/api/tenant/hris/employees", {
    method: "POST",
    token,
    body: {
      fullName: `Smoke HRIS ${runId}`,
      email: `smoke.hris.${runId}@example.test`,
      employmentStatus: "PKWTT",
      status: "active",
      bankName: "BCA",
      bankAccountNumber: `SMOKE${runId}`
    }
  });
  assert(employee.id, "Employee creation failed.");
  assert(employee.user?.mustChangePassword === true, "Employee account should require password change.");

  const employeeLogin = await request("/auth/login", {
    method: "POST",
    body: { email: employee.email, password: "user12345" }
  });
  assert(employeeLogin.user?.role === "employee", "Employee login did not return employee role.");
  assert(employeeLogin.user?.mustChangePassword === true, "Employee login should require password change.");

  const changedPassword = `User${runId}!`;
  const changedSession = await request("/auth/change-password", {
    method: "POST",
    token: employeeLogin.accessToken,
    body: { currentPassword: "user12345", newPassword: changedPassword }
  });
  assert(changedSession.user?.mustChangePassword === false, "Password change did not clear mustChangePassword.");

  const employees = await request(`/api/tenant/hris/employees?search=${encodeURIComponent(employee.fullName)}`, { token });
  assert(Array.isArray(employees) && employees.some((item) => item.id === employee.id), "Created employee was not found in employee list.");
  console.log("   ✅ Employee created & listed");

  // 3. Attendance & Face Liveness
  console.log("3. Testing Attendance & Liveness...");
  const photoUrl = makeImageDataUrl(31);
  const frameUrl = makeImageDataUrl(33);
  const enrollment = await request("/api/tenant/hris/attendance/face-profile/enroll", {
    method: "POST",
    token,
    body: { employeeId: employee.id, photoUrl }
  });
  assert(enrollment.enrolled, "Face enrollment did not complete.");

  const challenge = await request("/api/tenant/hris/attendance/liveness-challenge", {
    method: "POST",
    token,
    body: { employeeId: employee.id }
  });
  assert(challenge.challenge, "Liveness challenge did not return a challenge.");

  const attendance = await request("/api/tenant/hris/attendance/clock-in", {
    method: "POST",
    token,
    body: {
      employeeId: employee.id,
      photoUrl,
      livenessChallenge: challenge.challenge,
      livenessFrames: [frameUrl],
      deviceInfo: `smoke-device-${runId}`
    }
  });
  assert(attendance.id && attendance.isFaceMatched && attendance.isLivenessVerified, "Attendance verification failed.");
  console.log("   ✅ Attendance clock-in successful");

  // 4. Leave Management
  console.log("4. Testing Leave Management...");
  const leave = await request("/api/tenant/hris/leave", {
    method: "POST",
    token,
    body: {
      employeeId: employee.id,
      type: "Unpaid Leave",
      startDate: "2026-06-10",
      endDate: "2026-06-10",
      reason: "Smoke test unpaid leave"
    }
  });
  assert(leave.id, "Leave creation failed.");

  const approvedLeave = await request(`/api/tenant/hris/leave/${leave.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Approved" }
  });
  assert(approvedLeave.status === "Approved", "Leave approval failed.");
  console.log("   ✅ Leave approved");

  // 5. HR Operations
  console.log("5. Testing HR Operations...");
  
  // 5.1 Reimbursement
  const reimbursement = await request("/api/tenant/hris/reimbursement", {
    method: "POST",
    token,
    body: {
      employeeId: employee.id,
      amount: 150000,
      type: "Travel",
      notes: "Test Reimbursement"
    }
  });
  assert(reimbursement.id, "Reimbursement creation failed.");
  
  const approvedReimb = await request(`/api/tenant/hris/reimbursement/${reimbursement.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Approved" }
  });
  assert(approvedReimb.status === "Approved", "Reimbursement approval failed.");

  // 5.1b Kasbon / employee loan
  const loan = await request("/api/tenant/hris/loans", {
    method: "POST",
    token: employeeLogin.accessToken,
    body: {
      amount: 1200000,
      installmentMonths: 3,
      reason: "Smoke test kasbon"
    }
  });
  assert(loan.id && Number(loan.monthlyDeduction) === 400000, "Loan request creation failed.");

  const approvedLoan = await request(`/api/tenant/hris/loans/${loan.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Approved" }
  });
  assert(approvedLoan.status === "Approved", "Loan approval failed.");

  // 5.2 Field Report
  const fieldReport = await request("/api/tenant/hris/field-report", {
    method: "POST",
    token,
    body: {
      employeeId: employee.id,
      locationName: "Client Office A",
      latitude: -6.2,
      longitude: 106.8,
      notes: "Met with client"
    }
  });
  assert(fieldReport.id, "Field Report creation failed.");

  // 5.3 KPI
  const kpi = await request("/api/tenant/hris/performance", {
    method: "POST",
    token,
    body: {
      employeeId: employee.id,
      metricName: "Sales Target",
      targetValue: 100,
      actualValue: 85
    }
  });
  console.log("KPI Response:", kpi);
  assert(kpi.id && Number(kpi.score) === 85, "KPI creation failed or score is wrong.");

  // 5.4 Recruitment
  const job = await request("/api/tenant/hris/recruitment/jobs", {
    method: "POST",
    token,
    body: {
      title: "Senior Engineer",
      description: "Needs 5+ yrs experience."
    }
  });
  assert(job.id, "Job posting creation failed.");

  const applicant = await request(`/api/tenant/hris/recruitment/jobs/${job.id}/applicants`, {
    method: "POST",
    token,
    body: {
      fullName: "John Applicant",
      email: "john@example.com",
      phone: "08123456789"
    }
  });
  assert(applicant.id, "Job applicant creation failed.");
  
  console.log("   ✅ HR Operations successful");

  // 6. Payroll
  console.log("6. Testing Payroll...");
  const payrollPeriod = `2026-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}`;
  const payroll = await request("/api/tenant/hris/payroll", {
    method: "POST",
    token,
    body: { period: payrollPeriod }
  });
  assert(payroll.id && payroll.items?.length, "Payroll run creation failed.");

  const finalized = await request(`/api/tenant/hris/payroll/${payroll.id}/finalize`, {
    method: "POST",
    token
  });
  assert(finalized.status === "finalized", "Payroll finalization failed.");

  const payslips = await request(`/api/tenant/hris/payroll/${payroll.id}/payslips`, { token });
  assert(Array.isArray(payslips) && payslips.length > 0, "Payslip list is empty.");
  console.log("   ✅ Payroll finalized and payslips generated");

  // 7. Dashboard Export
  console.log("7. Testing Dashboard Export...");
  const exportData = await request("/api/tenant/hris/dashboard/export?format=excel", { token });
  assert(exportData.content, "Dashboard export failed.");
  console.log("   ✅ Dashboard export successful");

  console.log("\n✅ ALL E2E TESTS PASSED!");
}

main().catch((error) => {
  console.error("❌ E2E TEST FAILED:");
  console.error(error.message);
  process.exit(1);
});
