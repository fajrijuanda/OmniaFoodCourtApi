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
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const login = await request("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD }
  });
  const token = login.accessToken;
  assert(token, "Login did not return accessToken.");

  const me = await request("/auth/me", { token });
  assert(me.email, "Auth session is missing user email.");

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

  const payroll = await request("/api/tenant/hris/payroll", {
    method: "POST",
    token,
    body: { period: `2026-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}` }
  });
  assert(payroll.id && payroll.items?.length, "Payroll run creation failed.");

  const finalized = await request(`/api/tenant/hris/payroll/${payroll.id}/finalize`, {
    method: "POST",
    token
  });
  assert(finalized.status === "finalized", "Payroll finalization failed.");

  const payslips = await request(`/api/tenant/hris/payroll/${payroll.id}/payslips`, { token });
  assert(Array.isArray(payslips) && payslips.length > 0, "Payslip list is empty.");

  const dashboard = await request("/api/tenant/hris/dashboard/summary", { token });
  assert(dashboard && typeof dashboard === "object", "Dashboard summary failed.");

  console.log(JSON.stringify({
    ok: true,
    apiUrl: API_URL,
    user: me.email,
    employeeId: employee.id,
    attendanceId: attendance.id,
    leaveId: leave.id,
    payrollRunId: payroll.id,
    payslipCount: payslips.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
