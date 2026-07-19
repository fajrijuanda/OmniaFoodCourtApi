import { Employee, PrismaClient, UserRole } from "@prisma/client";

const demoTenantName = "Omnia Demo Workspace";
const demoOwnerEmail = "owner@omnia.local";
const demoEmployeeEmail = "employee@omnia.local";

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export async function seedPortalDemo(prisma: PrismaClient) {
  const now = new Date();
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant-omnia" },
    update: {
      name: demoTenantName,
      status: "active",
      workLocationLat: -6.2,
      workLocationLng: 106.816666,
      geofenceRadius: 150
    },
    create: {
      id: "demo-tenant-omnia",
      name: demoTenantName,
      status: "active",
      workLocationLat: -6.2,
      workLocationLng: 106.816666,
      geofenceRadius: 150
    }
  });

  const [owner, employee] = await Promise.all([
    prisma.user.findUnique({ where: { email: demoOwnerEmail } }),
    prisma.user.findUnique({ where: { email: demoEmployeeEmail } })
  ]);

  const mainBranch = await prisma.tenantBranch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } },
    update: {
      name: "Main Branch",
      status: "active",
      workLocationLat: -6.2,
      workLocationLng: 106.816666,
      geofenceRadius: 150
    },
    create: {
      tenantId: tenant.id,
      name: "Main Branch",
      code: "MAIN",
      status: "active",
      workLocationLat: -6.2,
      workLocationLng: 106.816666,
      geofenceRadius: 150
    }
  });

  for (const user of [owner, employee].filter(Boolean)) {
    const tenantUser = await prisma.tenantUser.upsert({
      where: { userId_tenantId: { userId: user!.id, tenantId: tenant.id } },
      update: { role: user!.role === UserRole.employee ? "employee" : "owner" },
      create: { userId: user!.id, tenantId: tenant.id, role: user!.role === UserRole.employee ? "employee" : "owner" }
    });
    await prisma.tenantUserBranch.upsert({
      where: { tenantUserId_branchId: { tenantUserId: tenantUser.id, branchId: mainBranch.id } },
      update: {},
      create: { tenantUserId: tenantUser.id, branchId: mainBranch.id }
    });
  }

  await clearDemoOperationalData(prisma, tenant.id);
  await seedDemoSubscriptions(prisma, tenant.id, now);
  const employees = await seedHrisDemo(prisma, tenant.id, now);
  if (process.env.SEED_FNB_DEMO_DATA === "true") {
    await seedFnbDemo(prisma, tenant.id, now);
  } else {
    console.log("Skipping F&B demo seed. Set SEED_FNB_DEMO_DATA=true to seed F&B workspace data.");
  }
  await seedChurchDemo(prisma, tenant.id, now);
  await seedClinicOpsDemo(prisma, tenant.id, mainBranch.id, employees.map((item) => item.employee), owner?.id ?? null, now);
  await seedCampusDemo(prisma, tenant.id, mainBranch.id, employees.map((item) => item.employee), now);
  await seedSocialCommerceDemo(prisma, tenant.id, mainBranch.id, now);
  await seedNotifications(prisma, tenant.id, owner?.id ?? null, now);

  const internalTenant = await prisma.tenant.upsert({
    where: { id: "pt-omnia-internal" },
    update: { name: "PT Omnia (Internal)", status: "active" },
    create: { id: "pt-omnia-internal", name: "PT Omnia (Internal)", status: "active" }
  });
  const internalBranch = await prisma.tenantBranch.upsert({
    where: { tenantId_code: { tenantId: internalTenant.id, code: "MAIN" } },
    update: { name: "HQ", status: "active" },
    create: { tenantId: internalTenant.id, name: "HQ", code: "MAIN", status: "active" }
  });
  const admin = await prisma.user.findUnique({ where: { email: "admin@omnia.local" } });
  if (admin) {
    const adminMembership = await prisma.tenantUser.upsert({
      where: { userId_tenantId: { userId: admin.id, tenantId: internalTenant.id } },
      update: { role: "owner" },
      create: { userId: admin.id, tenantId: internalTenant.id, role: "owner" }
    });
    await prisma.tenantUserBranch.upsert({
      where: { tenantUserId_branchId: { tenantUserId: adminMembership.id, branchId: internalBranch.id } },
      update: {},
      create: { tenantUserId: adminMembership.id, branchId: internalBranch.id }
    });
  }

  console.log(`Portal demo seeded for ${demoTenantName}: ${employees.length} employees.`);
}

async function clearDemoOperationalData(prisma: PrismaClient, tenantId: string) {
  const payrollRuns = await prisma.payrollRun.findMany({ where: { tenantId }, select: { id: true } });
  await prisma.$transaction([
    prisma.payrollRunItem.deleteMany({ where: { payrollRunId: { in: payrollRuns.map((run) => run.id) } } }),
    prisma.clinicSatuSehatSyncLog.deleteMany({ where: { tenantId } }),
    prisma.clinicLabMailboxMessage.deleteMany({ where: { tenantId } }),
    prisma.clinicPatientTransfer.deleteMany({ where: { tenantId } }),
    prisma.clinicCashierClosing.deleteMany({ where: { tenantId } }),
    prisma.clinicPayment.deleteMany({ where: { tenantId } }),
    prisma.clinicInvoiceItem.deleteMany({ where: { invoice: { tenantId } } }),
    prisma.clinicInvoice.deleteMany({ where: { tenantId } }),
    prisma.clinicStockOpname.deleteMany({ where: { tenantId } }),
    prisma.clinicPurchaseOrder.deleteMany({ where: { tenantId } }),
    prisma.clinicDrugMovement.deleteMany({ where: { tenantId } }),
    prisma.clinicDrugStock.deleteMany({ where: { tenantId } }),
    prisma.clinicPrescriptionItem.deleteMany({ where: { prescription: { tenantId } } }),
    prisma.clinicPrescription.deleteMany({ where: { tenantId } }),
    prisma.clinicTreatment.deleteMany({ where: { visit: { tenantId } } }),
    prisma.clinicDiagnosis.deleteMany({ where: { visit: { tenantId } } }),
    prisma.clinicVisitSoap.deleteMany({ where: { visit: { tenantId } } }),
    prisma.clinicVisitVital.deleteMany({ where: { visit: { tenantId } } }),
    prisma.clinicVisit.deleteMany({ where: { tenantId } }),
    prisma.clinicQueueTicket.deleteMany({ where: { tenantId } }),
    prisma.clinicAppointment.deleteMany({ where: { tenantId } }),
    prisma.clinicDrug.deleteMany({ where: { tenantId } }),
    prisma.clinicService.deleteMany({ where: { tenantId } }),
    prisma.clinicPatient.deleteMany({ where: { tenantId } }),
    prisma.churchVolunteerSchedule.deleteMany({ where: { tenantId } }),
    prisma.churchCellGroupMember.deleteMany({ where: { cellGroup: { tenantId } } }),
    prisma.churchDonation.deleteMany({ where: { tenantId } }),
    prisma.churchAsset.deleteMany({ where: { tenantId } }),
    prisma.churchEvent.deleteMany({ where: { tenantId } }),
    prisma.churchCellGroup.deleteMany({ where: { tenantId } }),
    prisma.churchMember.deleteMany({ where: { tenantId } }),
    prisma.fnbTenantSettlement.deleteMany({ where: { tenantId } }),
    prisma.fnbFoodCourtTenant.deleteMany({ where: { tenantId } }),
    prisma.fnbDeliveryStatus.deleteMany({ where: { tenantId } }),
    prisma.fnbDeliveryIntegration.deleteMany({ where: { tenantId } }),
    prisma.fnbWholesaleOrder.deleteMany({ where: { tenantId } }),
    prisma.fnbWholesaleCustomer.deleteMany({ where: { tenantId } }),
    prisma.fnbBakeryPreOrder.deleteMany({ where: { tenantId } }),
    prisma.fnbPromoRule.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceReport.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceExperiment.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceAlert.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceActionCard.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceCompetitorWatch.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceCreatorSignal.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceProductTrend.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceConnector.deleteMany({ where: { tenantId } }),
    prisma.socialCommerceWorkspaceSetting.deleteMany({ where: { tenantId } }),
    prisma.posStockLog.deleteMany({ where: { tenantId } }),
    prisma.posRecipeItem.deleteMany({ where: { recipe: { product: { tenantId } } } }),
    prisma.posRecipe.deleteMany({ where: { product: { tenantId } } }),
    prisma.posOrderItem.deleteMany({ where: { order: { tenantId } } }),
    prisma.posOrder.deleteMany({ where: { tenantId } }),
    prisma.posShift.deleteMany({ where: { tenantId } }),
    prisma.posTable.deleteMany({ where: { tenantId } }),
    prisma.posModifierGroupProduct.deleteMany({ where: { product: { tenantId } } }),
    prisma.posModifierOption.deleteMany({ where: { modifierGroup: { tenantId } } }),
    prisma.posModifierGroup.deleteMany({ where: { tenantId } }),
    prisma.posProductVariant.deleteMany({ where: { product: { tenantId } } }),
    prisma.posProduct.deleteMany({ where: { tenantId } }),
    prisma.posCategory.deleteMany({ where: { tenantId } }),
    prisma.posIngredient.deleteMany({ where: { tenantId } }),
    prisma.jobApplicant.deleteMany({ where: { tenantId } }),
    prisma.jobPosting.deleteMany({ where: { tenantId } }),
    prisma.performanceKpi.deleteMany({ where: { tenantId } }),
    prisma.fieldReport.deleteMany({ where: { tenantId } }),
    prisma.reimbursementRequest.deleteMany({ where: { tenantId } }),
    prisma.payrollRun.deleteMany({ where: { tenantId } }),
    prisma.salaryComponent.deleteMany({ where: { tenantId } }),
    prisma.leaveRequest.deleteMany({ where: { tenantId } }),
    prisma.attendanceLog.deleteMany({ where: { tenantId } }),
    prisma.employee.deleteMany({ where: { tenantId } }),
    prisma.department.deleteMany({ where: { tenantId } }),
    prisma.notification.deleteMany({ where: { tenantId } }),
    prisma.campusAnnouncement.deleteMany({ where: { tenantId } }),
    prisma.campusPayment.deleteMany({ where: { tenantId } }),
    prisma.campusInvoice.deleteMany({ where: { tenantId } }),
    prisma.campusApproval.deleteMany({ where: { tenantId } }),
    prisma.campusDocument.deleteMany({ where: { tenantId } }),
    prisma.campusAcademicRequest.deleteMany({ where: { tenantId } }),
    prisma.campusKknReport.deleteMany({ where: { tenantId } }),
    prisma.campusKknLogbook.deleteMany({ where: { tenantId } }),
    prisma.campusKknGroupMember.deleteMany({ where: { group: { tenantId } } }),
    prisma.campusKknGroup.deleteMany({ where: { tenantId } }),
    prisma.campusKknLocation.deleteMany({ where: { tenantId } }),
    prisma.campusKknPeriod.deleteMany({ where: { tenantId } }),
    prisma.campusGrade.deleteMany({ where: { tenantId } }),
    prisma.campusSubmission.deleteMany({ where: { tenantId } }),
    prisma.campusAssignment.deleteMany({ where: { tenantId } }),
    prisma.campusAttendance.deleteMany({ where: { tenantId } }),
    prisma.campusEnrollment.deleteMany({ where: { tenantId } }),
    prisma.campusClass.deleteMany({ where: { tenantId } }),
    prisma.campusCourse.deleteMany({ where: { tenantId } }),
    prisma.campusStudent.deleteMany({ where: { tenantId } }),
    prisma.campusStudyProgram.deleteMany({ where: { tenantId } }),
    prisma.campusFaculty.deleteMany({ where: { tenantId } })
  ]);
}

async function seedDemoSubscriptions(prisma: PrismaClient, tenantId: string, now: Date) {
  const wanted = [
    { sub: "HRIS", tier: "Pro", status: "active", price: 12000 },
    { sub: "Cafe", tier: "Growth", status: "active", price: 220000 },
    { sub: "Church", tier: "Pro", status: "active", price: 3500000 },
    { sub: "Klinik", tier: "Pro", status: "active", price: 2500000 },
    { sub: "Higher Education", tier: "Pro", status: "active", price: 10000000 },
    { sub: "Social Commerce Intelligence", tier: "Business", status: "active", price: 2490000 }
  ];

  for (const item of wanted) {
    const tier = await prisma.tier.findFirst({
      where: {
        subIndustry: {
          OR: [
            { name: item.sub },
            { name: { contains: item.sub, mode: "insensitive" } },
            { slug: { contains: item.sub.toLowerCase(), mode: "insensitive" } }
          ]
        },
        name: { contains: item.tier, mode: "insensitive" },
        isActive: true
      },
      include: { subIndustry: true }
    });
    if (!tier) continue;

    const existing = await prisma.tenantSubscription.findFirst({
      where: { tenantId, subIndustryId: tier.subIndustryId }
    });

    const data = {
      tierId: tier.id,
      subIndustryId: tier.subIndustryId,
      status: item.status,
      startedAt: addDays(now, -12),
      currentPeriodEnd: addDays(now, 18),
      price: item.price
    };

    if (existing) await prisma.tenantSubscription.update({ where: { id: existing.id }, data });
    else await prisma.tenantSubscription.create({ data: { tenantId, ...data } });
  }
}

async function seedHrisDemo(prisma: PrismaClient, tenantId: string, now: Date) {
  const departments = ["People", "Finance", "Operations", "Product", "Sales", "Support", "Technology"];
  const departmentRows = new Map<string, string>();
  for (const [index, name] of departments.entries()) {
    const row = await prisma.department.upsert({
      where: { id: `demo-dept-${name.toLowerCase()}` },
      update: { tenantId, name, code: name.slice(0, 3).toUpperCase() },
      create: { id: `demo-dept-${name.toLowerCase()}`, tenantId, name, code: name.slice(0, 3).toUpperCase() }
    });
    departmentRows.set(name, row.id);
  }

  const employees = [
    ["EMP-0001", "Alya Putri", "People", "PKWTT", "active", 8900000, 400000],
    ["EMP-0002", "Raka Pratama", "Finance", "PKWTT", "active", 9700000, 500000],
    ["EMP-0003", "Nadia Safira", "Operations", "PKWTT", "active", 10600000, 600000],
    ["EMP-0004", "Dimas Ardi", "Product", "Probation", "active", 12000000, 500000],
    ["EMP-0005", "Mira Lestari", "Sales", "PKWTT", "active", 8250000, 450000],
    ["EMP-0006", "Bagas Wicaksono", "Support", "PKWTT", "active", 8000000, 400000],
    ["EMP-0007", "Citra Maharani", "Product", "PKWTT", "active", 9300000, 400000],
    ["EMP-0008", "Yusuf Akbar", "Technology", "Contract", "active", 7600000, 400000]
  ] as const;

  const saved = [];
  for (const row of employees) {
    const employee = await prisma.employee.upsert({
      where: { tenantId_employeeNumber: { tenantId, employeeNumber: row[0] } },
      update: {
        fullName: row[1],
        departmentId: departmentRows.get(row[2]) ?? null,
        employmentStatus: row[3],
        status: row[4],
        joinDate: addDays(now, -240)
      },
      create: {
        tenantId,
        employeeNumber: row[0],
        fullName: row[1],
        departmentId: departmentRows.get(row[2]) ?? null,
        employmentStatus: row[3],
        status: row[4],
        joinDate: addDays(now, -240),
        bankName: "BCA",
        bankAccountNumber: `2026${row[0].replace(/\D/g, "")}`
      }
    });
    saved.push({ employee, gross: row[5], deduction: row[6] });
  }

  for (const [index, item] of saved.entries()) {
    const clockIn = new Date(now);
    clockIn.setHours(index === 1 || index === 7 ? 9 : 8, index === 1 ? 18 : 54, 0, 0);
    await prisma.attendanceLog.createMany({
      data: [{
        tenantId,
        employeeId: item.employee.id,
        clockInAt: clockIn,
        clockOutAt: index < 3 ? addDays(clockIn, 0) : null,
        status: index === 1 || index === 7 ? "late" : index === 4 ? "leave" : "present",
        latitude: -6.2,
        longitude: 106.816666,
        isFaceMatched: true,
        isLivenessVerified: true,
        deviceInfo: "Seeder kiosk"
      }],
      skipDuplicates: true
    });
  }

  for (const item of saved.slice(0, 4)) {
    await prisma.leaveRequest.createMany({
      data: [{
        tenantId,
        employeeId: item.employee.id,
        type: item.employee.fullName === "Alya Putri" ? "Permit" : "Annual Leave",
        startDate: addDays(now, 7),
        endDate: addDays(now, 8),
        reason: "Demo approval request",
        status: item.employee.fullName === "Raka Pratama" ? "Rejected" : item.employee.fullName === "Nadia Safira" ? "Approved" : "Pending"
      }],
      skipDuplicates: true
    });
  }

  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const existingPayroll = await prisma.payrollRun.findFirst({ where: { tenantId, period } });
  const payroll = existingPayroll
    ? await prisma.payrollRun.update({
      where: { id: existingPayroll.id },
      data: {
      status: "draft",
      grossTotal: saved.reduce((sum, item) => sum + item.gross, 0),
      deductionTotal: saved.reduce((sum, item) => sum + item.deduction, 0),
      netTotal: saved.reduce((sum, item) => sum + item.gross - item.deduction, 0)
      }
    })
    : await prisma.payrollRun.create({
      data: {
      tenantId,
      period,
      status: "draft",
      grossTotal: saved.reduce((sum, item) => sum + item.gross, 0),
      deductionTotal: saved.reduce((sum, item) => sum + item.deduction, 0),
      netTotal: saved.reduce((sum, item) => sum + item.gross - item.deduction, 0)
      }
    });

  for (const item of saved) {
    await prisma.payrollRunItem.upsert({
      where: { payrollRunId_employeeId: { payrollRunId: payroll.id, employeeId: item.employee.id } },
      update: {
        grossAmount: item.gross,
        deductionAmount: item.deduction,
        netAmount: item.gross - item.deduction,
        status: item.employee.fullName === "Nadia Safira" ? "ready" : "paid"
      },
      create: {
        payrollRunId: payroll.id,
        employeeId: item.employee.id,
        grossAmount: item.gross,
        deductionAmount: item.deduction,
        netAmount: item.gross - item.deduction,
        status: item.employee.fullName === "Nadia Safira" ? "ready" : "paid"
      }
    });
  }

  return saved;
}

async function seedFnbDemo(prisma: PrismaClient, tenantId: string, now: Date) {
  const categories = [
    ["coffee", "Coffee", "Coffee"],
    ["food", "Food", "Utensils"],
    ["dessert", "Dessert", "Cake"],
    ["beverage", "Beverage", "CupSoda"]
  ] as const;

  const categoryIds = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const row = await prisma.posCategory.upsert({
      where: { tenantId_slug: { tenantId, slug: category[0] } },
      update: { name: category[1], icon: category[2], sortOrder: index, isActive: true },
      create: { tenantId, slug: category[0], name: category[1], icon: category[2], sortOrder: index, isActive: true }
    });
    categoryIds.set(category[0], row.id);
  }

  const products = [
    ["coffee", "Kopi Susu Gula Aren", "Espresso, susu segar, gula aren", 25000],
    ["coffee", "Americano", "Espresso dan air panas", 22000],
    ["beverage", "Matcha Latte", "Matcha premium dan susu", 30000],
    ["food", "Nasi Goreng Spesial", "Nasi goreng, telur, ayam suwir", 45000],
    ["food", "Kentang Goreng", "French fries dan saus", 20000],
    ["dessert", "Croissant Butter", "Croissant butter harian", 28000]
  ] as const;

  const productIds = new Map<string, string>();
  for (const [index, product] of products.entries()) {
    const row = await prisma.posProduct.upsert({
      where: { id: `demo-pos-product-${index + 1}` },
      update: {
        tenantId,
        categoryId: categoryIds.get(product[0])!,
        name: product[1],
        description: product[2],
        price: product[3],
        isAvailable: true,
        sortOrder: index
      },
      create: {
        id: `demo-pos-product-${index + 1}`,
        tenantId,
        categoryId: categoryIds.get(product[0])!,
        name: product[1],
        description: product[2],
        price: product[3],
        isAvailable: true,
        sortOrder: index
      }
    });
    productIds.set(product[1], row.id);
  }

  for (let index = 1; index <= 8; index++) {
    await prisma.posTable.upsert({
      where: { tenantId_name: { tenantId, name: `Meja ${String(index).padStart(2, "0")}` } },
      update: { capacity: index > 6 ? 6 : 4, status: index === 4 ? "OCCUPIED" : "AVAILABLE" },
      create: { tenantId, name: `Meja ${String(index).padStart(2, "0")}`, capacity: index > 6 ? 6 : 4, status: index === 4 ? "OCCUPIED" : "AVAILABLE" }
    });
  }

  const orders = [
    ["INV/2026/06/01/001", "Walk-in", "DINE_IN", "QRIS", "Kopi Susu Gula Aren", 3],
    ["INV/2026/06/01/002", "Meja 04", "DINE_IN", "CASH", "Nasi Goreng Spesial", 2],
    ["INV/2026/06/01/003", "Takeaway", "TAKEAWAY", "QRIS", "Matcha Latte", 5],
    ["INV/2026/06/01/004", "Delivery", "DELIVERY", "TRANSFER", "Croissant Butter", 6]
  ] as const;

  for (const [index, order] of orders.entries()) {
    const product = await prisma.posProduct.findUnique({ where: { id: productIds.get(order[4])! } });
    if (!product) continue;
    await prisma.posOrder.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: order[0] } },
      update: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        kitchenStatus: "DELIVERED",
        totalAmount: Number(product.price) * order[5],
        paymentMethod: order[3],
        orderType: order[2],
        customerName: order[1],
        createdAt: addDays(now, -index)
      },
      create: {
        tenantId,
        invoiceNumber: order[0],
        status: "COMPLETED",
        paymentStatus: "PAID",
        kitchenStatus: "DELIVERED",
        totalAmount: Number(product.price) * order[5],
        paymentMethod: order[3],
        orderType: order[2],
        customerName: order[1],
        createdAt: addDays(now, -index),
        items: { create: [{ productId: product.id, quantity: order[5], priceAtSale: product.price }] }
      }
    });
  }

  await prisma.fnbPromoRule.createMany({
    data: [
      { tenantId, name: "Lunch Bundle", type: "Bundle", tenantName: "Semua tenant", status: "Aktif", startDate: addDays(now, -5), endDate: addDays(now, 20) },
      { tenantId, name: "Weekend Coffee", type: "Discount", tenantName: "Cafe", status: "Aktif", startDate: addDays(now, -2), endDate: addDays(now, 8) }
    ],
    skipDuplicates: true
  });
}

async function seedSocialCommerceDemo(prisma: PrismaClient, tenantId: string, branchId: string, now: Date) {
  const channels = ["tiktok_shop", "shopee", "tokopedia", "lazada", "blibli"];
  await prisma.socialCommerceWorkspaceSetting.create({
    data: {
      tenantId,
      branchId,
      market: "Indonesia",
      preset: "Beauty, Home, Electronics, Fashion, FMCG",
      channels,
      categories: ["Beauty", "Home", "Electronics", "Fashion", "FMCG"],
      notes: "Demo seeded intelligence. Marketplace live connectors need official credentials."
    }
  });

  await prisma.socialCommerceConnector.createMany({
    data: [
      { tenantId, branchId, channel: "tiktok_shop", displayName: "TikTok Shop", status: "active", lastSyncAt: now, credentialHint: "Demo mode active", notes: "Live connector queued for official API credentials." },
      { tenantId, branchId, channel: "shopee", displayName: "Shopee", status: "active", lastSyncAt: now, credentialHint: "Demo mode active", notes: "Tracks rank, review velocity, and pricing proxy." },
      { tenantId, branchId, channel: "tokopedia", displayName: "Tokopedia", status: "queued", credentialHint: "Seller API/app review required", notes: "Prepared for official integration." },
      { tenantId, branchId, channel: "lazada", displayName: "Lazada", status: "needs_credentials", credentialHint: "Open Platform credential required", notes: "Credential slot ready." },
      { tenantId, branchId, channel: "blibli", displayName: "Blibli", status: "disabled", credentialHint: "Partner API access required", notes: "Available in demo catalog." }
    ],
    skipDuplicates: true
  });

  const productRows = [
    ["Hair serum travel pack", "Beauty", "tiktok_shop", 3, "+28% creator velocity", 92, "Fresh", 88, 34, 69000, 99000, 184000000, 312, 64, "Test bundle mini size minggu ini", "watch"],
    ["Retinol body lotion", "Beauty", "shopee", 7, "+19% review velocity", 84, "Heating", 81, 31, 59000, 129000, 221000000, 428, 39, "Shortlist 5 creator skincare micro", "watch"],
    ["Magnetic cable organizer", "Home", "tokopedia", 11, "+21% wishlist proxy", 79, "Heating", 74, 29, 25000, 49000, 76000000, 156, 18, "Uji angle desk setup dan paket 3 pcs", "watch"],
    ["Portable blender cup", "Electronics", "lazada", 15, "Ad pressure naik", 62, "Crowded", 67, 21, 119000, 189000, 136000000, 84, 22, "Stop jika CPA di atas Rp38rb", "review"],
    ["LED vanity mirror", "Beauty", "blibli", 21, "Price compression", 44, "Saturated", 82, 13, 79000, 149000, 93000000, 64, 11, "Tahan stok baru dan pantau margin", "avoid"],
    ["Hijab sport instant", "Fashion", "tiktok_shop", 6, "+34% live mention", 87, "Fresh", 79, 36, 45000, 89000, 168000000, 219, 47, "Buat live script sweat test", "watch"],
    ["Kopi susu literan low sugar", "FMCG", "shopee", 9, "+17% repeat purchase proxy", 76, "Heating", 72, 25, 42000, 69000, 112000000, 183, 16, "Tes bundling 2 botol + cold pack", "watch"],
    ["Foldable storage box", "Home", "tokopedia", 5, "+24% cart velocity", 89, "Fresh", 85, 33, 39000, 79000, 197000000, 254, 29, "Naikkan budget demo organizing", "scale"]
  ] as const;

  await prisma.socialCommerceProductTrend.createMany({
    data: productRows.map((row) => ({
      tenantId,
      branchId,
      productName: row[0],
      category: row[1],
      channel: row[2],
      marketplaceRank: row[3],
      signal: row[4],
      freshnessScore: row[5],
      saturationLevel: row[6],
      confidenceScore: row[7],
      marginEstimate: row[8],
      priceMin: row[9],
      priceMax: row[10],
      gmvProxy: row[11],
      reviewVelocity: row[12],
      creatorVelocity: row[13],
      recommendedAction: row[14],
      status: row[15],
      details: { source: "demo_seeded", disclaimer: "Not live marketplace data" }
    }))
  });

  await prisma.socialCommerceCreatorSignal.createMany({
    data: [
      { tenantId, branchId, handle: "@glowdaily.id", niche: "Beauty micro", channel: "tiktok_shop", fitScore: 92, gmvProxy: 118000000, commissionRange: "12-14%", audienceFit: "Wanita 18-34, skincare buyer", riskLevel: "low", note: "Audience match kuat untuk serum dan lotion." },
      { tenantId, branchId, handle: "@rumahrapi", niche: "Home living", channel: "shopee", fitScore: 87, gmvProxy: 76000000, commissionRange: "10-12%", audienceFit: "Home organizer buyer", riskLevel: "low", note: "Format demo meja kerja efektif." },
      { tenantId, branchId, handle: "@dealhunter.id", niche: "Affiliate deals", channel: "tokopedia", fitScore: 81, gmvProxy: 144000000, commissionRange: "14-16%", audienceFit: "Promo seeker", riskLevel: "medium", note: "Butuh margin guard." },
      { tenantId, branchId, handle: "@fitdailywear", niche: "Modest activewear", channel: "tiktok_shop", fitScore: 84, gmvProxy: 88000000, commissionRange: "11-13%", audienceFit: "Hijab sport audience", riskLevel: "low", note: "Cocok untuk sweat test." }
    ]
  });

  await prisma.socialCommerceCompetitorWatch.createMany({
    data: [
      { tenantId, branchId, shopName: "Glow Lab Official", channel: "tiktok_shop", category: "Beauty", movement: "+18% GMV proxy", risk: "Creator collab spike", response: "Pantau 3 SKU serum", velocityScore: 91, creatorCollabCount: 12 },
      { tenantId, branchId, shopName: "Beauty Flash ID", channel: "shopee", category: "Beauty", movement: "-7% price", risk: "Voucher pressure", response: "Jangan ikut perang harga", velocityScore: 78, priceChangePct: -7, creatorCollabCount: 5 },
      { tenantId, branchId, shopName: "HomeHack Store", channel: "tokopedia", category: "Home", movement: "+9 live sessions", risk: "Live angle baru", response: "Review replay hari ini", velocityScore: 74, priceChangePct: 2, creatorCollabCount: 3 },
      { tenantId, branchId, shopName: "Active Modest Co", channel: "tiktok_shop", category: "Fashion", movement: "+26% mention", risk: "Hijab sport angle naik", response: "Siapkan comparison script", velocityScore: 83, creatorCollabCount: 8 }
    ]
  });

  await prisma.socialCommerceActionCard.createMany({
    data: [
      { tenantId, branchId, title: "Test hair serum mini size minggu ini", body: "Freshness tinggi di TikTok Shop, creator crowding rendah, margin aman pada harga Rp89rb.", confidence: "High", actionLabel: "Buat experiment", moduleKey: "product-radar", priority: "high" },
      { tenantId, branchId, title: "Naikkan komisi affiliate serum ke 14%", body: "Top creator beauty merespons lebih cepat di komisi 13-15% pada benchmark kategori.", confidence: "Medium", actionLabel: "Update campaign", moduleKey: "campaign-planner", priority: "normal" },
      { tenantId, branchId, title: "Tahan produk LED vanity mirror", body: "Seller crowding naik dan price compression mulai menekan margin.", confidence: "High", actionLabel: "Mark as crowded", moduleKey: "alerts", priority: "high" }
    ]
  });

  await prisma.socialCommerceAlert.createMany({
    data: [
      { tenantId, branchId, title: "Fresh trend detected", body: "Hair serum travel pack melewati freshness 90 di TikTok Shop.", channel: "tiktok_shop", category: "Beauty", severity: "high", rule: "Freshness score > 85", triggeredAt: addDays(now, 0) },
      { tenantId, branchId, title: "Competitor spike", body: "Glow Lab Official naik +18% GMV proxy dalam 3 hari.", channel: "tiktok_shop", category: "Beauty", severity: "high", rule: "Competitor velocity naik 3 hari", triggeredAt: addDays(now, -1) },
      { tenantId, branchId, title: "Margin warning", body: "LED vanity mirror masuk zona margin safety 13%.", channel: "blibli", category: "Beauty", severity: "normal", rule: "Margin safety turun di bawah 20%", triggeredAt: addDays(now, -2) }
    ]
  });

  await prisma.socialCommerceExperiment.createMany({
    data: [
      { tenantId, branchId, title: "Serum mini: 3 creator micro", productName: "Hair serum travel pack", channel: "tiktok_shop", hypothesis: "Creator micro dengan before-after hook bisa menjaga CPA < Rp35rb.", status: "running", budget: 1500000, targetMetric: "CPA < Rp35rb" },
      { tenantId, branchId, title: "Cable organizer desk setup", productName: "Magnetic cable organizer", channel: "tokopedia", hypothesis: "Demo setup meja meningkatkan save rate dan cart velocity.", status: "backlog", budget: 750000, targetMetric: "Cart velocity +15%" },
      { tenantId, branchId, title: "Portable blender stop rule", productName: "Portable blender cup", channel: "lazada", hypothesis: "Produk tetap viable jika CPA di bawah Rp38rb.", status: "learning", budget: 1000000, targetMetric: "CPA < Rp38rb", result: "Ad pressure tinggi, perlu angle baru." }
    ]
  });

  await prisma.socialCommerceReport.create({
    data: {
      tenantId,
      branchId,
      title: "Weekly opportunity report",
      period: now.toISOString().slice(0, 10),
      summary: "Beauty dan Fashion memberi sinyal fresh tertinggi. Home organizer stabil untuk campaign evergreen. Hindari SKU crowded sampai margin membaik.",
      sections: ["Executive summary", "Product opportunities", "Competitor movement", "Creator shortlist", "Campaign recommendation", "Risk and saturation warning", "Next 7-day action plan"]
    }
  });
}

async function seedChurchDemo(prisma: PrismaClient, tenantId: string, now: Date) {
  const members = [
    ["Budi Hartono", "Male", "Jemaat Tetap"],
    ["Maria Lestari", "Female", "Jemaat Tetap"],
    ["Samuel Wijaya", "Male", "Simpatisan"],
    ["Grace Natalia", "Female", "Jemaat Tetap"],
    ["Daniel Setiawan", "Male", "Simpatisan"]
  ] as const;

  const saved = [];
  for (const [index, member] of members.entries()) {
    const existing = await prisma.churchMember.findFirst({ where: { tenantId, fullName: member[0] } });
    const data = { gender: member[1], status: member[2], phoneNumber: `081200000${index + 1}`, address: "Jakarta" };
    saved.push(existing ? await prisma.churchMember.update({ where: { id: existing.id }, data }) : await prisma.churchMember.create({ data: { tenantId, fullName: member[0], ...data } }));
  }

  const group = await prisma.churchCellGroup.upsert({
    where: { id: "demo-church-cell-group-1" },
    update: { tenantId, name: "Komsel Jakarta Pusat", leaderId: saved[0]?.id ?? null, schedule: "Rabu 19:00", location: "Menteng" },
    create: { id: "demo-church-cell-group-1", tenantId, name: "Komsel Jakarta Pusat", leaderId: saved[0]?.id ?? null, schedule: "Rabu 19:00", location: "Menteng" }
  });
  for (const member of saved.slice(0, 3)) {
    await prisma.churchCellGroupMember.upsert({
      where: { cellGroupId_memberId: { cellGroupId: group.id, memberId: member.id } },
      update: {},
      create: { cellGroupId: group.id, memberId: member.id }
    });
  }

  const event = await prisma.churchEvent.upsert({
    where: { id: "demo-church-event-1" },
    update: { tenantId, name: "Ibadah Raya Minggu", eventType: "Ibadah Raya", date: addDays(now, 4), location: "Main Hall" },
    create: { id: "demo-church-event-1", tenantId, name: "Ibadah Raya Minggu", eventType: "Ibadah Raya", date: addDays(now, 4), location: "Main Hall" }
  });

  if (saved[0]) {
    await prisma.churchVolunteerSchedule.createMany({
      data: [{ tenantId, eventId: event.id, memberId: saved[0].id, role: "Usher", status: "Confirmed" }],
      skipDuplicates: true
    });
  }

  for (const [index, member] of saved.entries()) {
    await prisma.churchDonation.createMany({
      data: [{ tenantId, memberId: member.id, amount: 250000 + index * 75000, type: index % 2 === 0 ? "Persepuluhan" : "Kolekte", date: addDays(now, -index * 6), paymentMethod: index % 2 === 0 ? "Transfer" : "QRIS" }],
      skipDuplicates: true
    });
  }

  await prisma.churchAsset.createMany({
    data: [
      { tenantId, name: "Main Hall", type: "Room", location: "Lantai 1", status: "Tersedia" },
      { tenantId, name: "Sound System A", type: "Item", location: "Storage", status: "Tersedia" },
      { tenantId, name: "Projector", type: "Item", location: "Main Hall", status: "Dipinjam" }
    ],
    skipDuplicates: true
  });
}

async function seedClinicOpsDemo(prisma: PrismaClient, tenantId: string, branchId: string, employees: Employee[], userId: string | null, now: Date) {
  const doctor = employees.find((employee) => employee.fullName.includes("Nadia")) ?? employees[0];
  const nurse = employees.find((employee) => employee.fullName.includes("Alya")) ?? employees[1] ?? employees[0];

  const services = [
    ["clinic-service-umum", "Poli Umum", "POLI-UM", "Poli", 150000],
    ["clinic-service-gigi", "Poli Gigi", "POLI-GG", "Poli", 250000],
    ["clinic-service-lab", "Pemeriksaan Lab Dasar", "LAB-01", "Lab", 180000],
    ["clinic-service-tindakan", "Nebulizer", "TRT-NEB", "Tindakan", 125000]
  ] as const;
  for (const service of services) {
    await prisma.clinicService.upsert({
      where: { id: service[0] },
      update: { tenantId, branchId, name: service[1], code: service[2], category: service[3], price: service[4], isActive: true },
      create: { id: service[0], tenantId, branchId, name: service[1], code: service[2], category: service[3], price: service[4], isActive: true }
    });
  }

  const patientRows = [
    ["clinic-patient-1", "RM-000001", "Sinta Rahma", "Female", "081300001001", -42],
    ["clinic-patient-2", "RM-000002", "Arman Maulana", "Male", "081300001002", -35],
    ["clinic-patient-3", "RM-000003", "Laras Ayuning", "Female", "081300001003", -28],
    ["clinic-patient-4", "RM-000004", "Fajar Nugroho", "Male", "081300001004", -31]
  ] as const;
  for (const patient of patientRows) {
    await prisma.clinicPatient.upsert({
      where: { tenantId_medicalRecordNo: { tenantId, medicalRecordNo: patient[1] } },
      update: {
        branchId,
        fullName: patient[2],
        gender: patient[3],
        phoneNumber: patient[4],
        dob: addDays(now, patient[5] * 365),
        address: "Jakarta",
        bloodType: patient[3] === "Female" ? "A" : "O",
        allergyNotes: patient[2] === "Sinta Rahma" ? "Alergi penicillin" : null
      },
      create: {
        id: patient[0],
        tenantId,
        branchId,
        medicalRecordNo: patient[1],
        fullName: patient[2],
        gender: patient[3],
        phoneNumber: patient[4],
        dob: addDays(now, patient[5] * 365),
        address: "Jakarta",
        bloodType: patient[3] === "Female" ? "A" : "O",
        allergyNotes: patient[2] === "Sinta Rahma" ? "Alergi penicillin" : null
      }
    });
  }

  const appointmentRows = [
    ["clinic-appointment-1", "clinic-patient-1", "clinic-service-umum", 0, "A001", "checked_in"],
    ["clinic-appointment-2", "clinic-patient-2", "clinic-service-gigi", 0, "A002", "scheduled"],
    ["clinic-appointment-3", "clinic-patient-3", "clinic-service-umum", 1, "A003", "scheduled"]
  ] as const;
  for (const appointment of appointmentRows) {
    const scheduledAt = new Date(now);
    scheduledAt.setHours(9 + appointment[3], 30, 0, 0);
    await prisma.clinicAppointment.upsert({
      where: { id: appointment[0] },
      update: {
        tenantId,
        branchId,
        patientId: appointment[1],
        serviceId: appointment[2],
        providerEmployeeId: doctor?.id ?? null,
        scheduledAt,
        queueNumber: appointment[4],
        status: appointment[5]
      },
      create: {
        id: appointment[0],
        tenantId,
        branchId,
        patientId: appointment[1],
        serviceId: appointment[2],
        providerEmployeeId: doctor?.id ?? null,
        scheduledAt,
        queueNumber: appointment[4],
        status: appointment[5]
      }
    });
  }

  await prisma.clinicQueueTicket.createMany({
    data: [
      { tenantId, branchId, patientId: "clinic-patient-1", appointmentId: "clinic-appointment-1", number: "A001", status: "called", station: "Ruang 1", calledAt: now },
      { tenantId, branchId, patientId: "clinic-patient-2", appointmentId: "clinic-appointment-2", number: "A002", status: "waiting" },
      { tenantId, branchId, patientId: "clinic-patient-3", appointmentId: "clinic-appointment-3", number: "A003", status: "waiting" }
    ],
    skipDuplicates: true
  });

  const visit = await prisma.clinicVisit.upsert({
    where: { id: "clinic-visit-1" },
    update: {
      tenantId,
      branchId,
      patientId: "clinic-patient-1",
      appointmentId: "clinic-appointment-1",
      serviceId: "clinic-service-umum",
      providerEmployeeId: doctor?.id ?? null,
      nurseEmployeeId: nurse?.id ?? null,
      chiefComplaint: "Demam dan batuk sejak dua hari",
      status: "open"
    },
    create: {
      id: "clinic-visit-1",
      tenantId,
      branchId,
      patientId: "clinic-patient-1",
      appointmentId: "clinic-appointment-1",
      serviceId: "clinic-service-umum",
      providerEmployeeId: doctor?.id ?? null,
      nurseEmployeeId: nurse?.id ?? null,
      chiefComplaint: "Demam dan batuk sejak dua hari",
      status: "open"
    }
  });
  await prisma.clinicVisitVital.upsert({
    where: { visitId: visit.id },
    update: { temperature: 38.2, systolic: 118, diastolic: 78, pulse: 88, respiration: 20, weight: 54, height: 160, oxygenSat: 98 },
    create: { visitId: visit.id, temperature: 38.2, systolic: 118, diastolic: 78, pulse: 88, respiration: 20, weight: 54, height: 160, oxygenSat: 98 }
  });
  await prisma.clinicVisitSoap.upsert({
    where: { visitId: visit.id },
    update: { subjective: "Demam, batuk produktif ringan.", objective: "Faring hiperemis, paru vesikuler.", assessment: "ISPA ringan.", plan: "Obat simptomatik dan kontrol bila memburuk." },
    create: { visitId: visit.id, subjective: "Demam, batuk produktif ringan.", objective: "Faring hiperemis, paru vesikuler.", assessment: "ISPA ringan.", plan: "Obat simptomatik dan kontrol bila memburuk." }
  });
  await prisma.clinicDiagnosis.createMany({
    data: [{ visitId: visit.id, code: "J06.9", name: "Acute upper respiratory infection", type: "primary" }],
    skipDuplicates: true
  });
  await prisma.clinicTreatment.createMany({
    data: [{ visitId: visit.id, name: "Konsultasi dokter umum", price: 150000 }],
    skipDuplicates: true
  });

  const drugRows = [
    ["clinic-drug-1", "OBT-PCM", "Paracetamol 500mg", "tablet", 500, 1500, 50, 180],
    ["clinic-drug-2", "OBT-CTM", "CTM 4mg", "tablet", 300, 1000, 40, 26],
    ["clinic-drug-3", "OBT-AMX", "Amoxicillin 500mg", "capsule", 1200, 3500, 30, 12]
  ] as const;
  for (const drug of drugRows) {
    await prisma.clinicDrug.upsert({
      where: { id: drug[0] },
      update: { tenantId, branchId, sku: drug[1], name: drug[2], unit: drug[3], costPrice: drug[4], salePrice: drug[5], minStock: drug[6], expiryDate: addDays(now, drug[7]) },
      create: { id: drug[0], tenantId, branchId, sku: drug[1], name: drug[2], unit: drug[3], costPrice: drug[4], salePrice: drug[5], minStock: drug[6], expiryDate: addDays(now, drug[7]) }
    });
    await prisma.clinicDrugStock.upsert({
      where: { branchId_drugId_batchNo: { branchId, drugId: drug[0], batchNo: "BATCH-DEMO" } },
      update: { tenantId, quantity: drug[0] === "clinic-drug-3" ? 8 : 120, expiryDate: addDays(now, drug[7]) },
      create: { tenantId, branchId, drugId: drug[0], batchNo: "BATCH-DEMO", quantity: drug[0] === "clinic-drug-3" ? 8 : 120, expiryDate: addDays(now, drug[7]) }
    });
  }

  await prisma.clinicDrugMovement.createMany({
    data: [
      { tenantId, branchId, drugId: "clinic-drug-1", type: "in", quantity: 120, reference: "Initial stock" },
      { tenantId, branchId, drugId: "clinic-drug-3", type: "adjustment", quantity: 8, reference: "Low stock demo" }
    ],
    skipDuplicates: true
  });

  await prisma.clinicPrescription.upsert({
    where: { id: "clinic-prescription-1" },
    update: { tenantId, branchId, patientId: "clinic-patient-1", visitId: visit.id, status: "issued", notes: "Minum setelah makan" },
    create: {
      id: "clinic-prescription-1",
      tenantId,
      branchId,
      patientId: "clinic-patient-1",
      visitId: visit.id,
      status: "issued",
      notes: "Minum setelah makan",
      items: {
        create: [
          { drugId: "clinic-drug-1", name: "Paracetamol 500mg", dosage: "3x1", quantity: 10, instructions: "Sesudah makan" },
          { drugId: "clinic-drug-2", name: "CTM 4mg", dosage: "1x1 malam", quantity: 5, instructions: "Sebelum tidur" }
        ]
      }
    }
  });

  const invoice = await prisma.clinicInvoice.upsert({
    where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: "KLINIK/2026/0001" } },
    update: { branchId, patientId: "clinic-patient-1", visitId: visit.id, status: "paid", totalAmount: 165000, paidAmount: 165000, paidAt: now },
    create: {
      tenantId,
      branchId,
      patientId: "clinic-patient-1",
      visitId: visit.id,
      invoiceNumber: "KLINIK/2026/0001",
      status: "paid",
      totalAmount: 165000,
      paidAmount: 165000,
      paidAt: now,
      items: {
        create: [
          { serviceId: "clinic-service-umum", name: "Konsultasi dokter umum", quantity: 1, unitPrice: 150000, totalAmount: 150000 },
          { drugId: "clinic-drug-1", name: "Paracetamol 500mg", quantity: 10, unitPrice: 1500, totalAmount: 15000 }
        ]
      }
    }
  });
  await prisma.clinicPayment.createMany({
    data: [{ tenantId, branchId, invoiceId: invoice.id, amount: 165000, method: "QRIS", status: "paid", paidAt: now }],
    skipDuplicates: true
  });
  await prisma.clinicCashierClosing.createMany({
    data: [{ tenantId, branchId, cashierUserId: userId, periodDate: now, systemAmount: 165000, actualAmount: 165000, status: "closed", notes: "Closing demo KlinikOps" }],
    skipDuplicates: true
  });
  await prisma.clinicPurchaseOrder.createMany({
    data: [{ tenantId, branchId, poNumber: "PO-KLN-0001", vendorName: "PT Farmasi Demo", status: "ordered", totalAmount: 2500000 }],
    skipDuplicates: true
  });
  await prisma.clinicStockOpname.createMany({
    data: [{ tenantId, branchId, code: "SO-KLN-0001", status: "draft", notes: "Stock opname awal bulan" }],
    skipDuplicates: true
  });
  await prisma.clinicLabMailboxMessage.createMany({
    data: [{ tenantId, branchId, vendor: "Lab Demo", subject: "Hasil darah lengkap Sinta Rahma", status: "new", payload: { patient: "RM-000001", result: "ready" } }],
    skipDuplicates: true
  });
  await prisma.clinicSatuSehatSyncLog.createMany({
    data: [{ tenantId, branchId, entityType: "Patient", entityId: "clinic-patient-1", status: "queued", requestJson: { mode: "demo" } }],
    skipDuplicates: true
  });
  await prisma.tenantAuditLog.createMany({
    data: [
      { tenantId, branchId, actorUserId: userId, action: "clinic.patient.create", module: "clinic", entityType: "ClinicPatient", entityId: "clinic-patient-1", after: { fullName: "Sinta Rahma" } },
      { tenantId, branchId, actorUserId: userId, action: "clinic.invoice.pay", module: "clinic", entityType: "ClinicInvoice", entityId: invoice.id, after: { amount: 165000, method: "QRIS" } }
    ],
    skipDuplicates: true
  });
}

async function seedNotifications(prisma: PrismaClient, tenantId: string, userId: string | null, now: Date) {
  await prisma.notification.deleteMany({ where: { tenantId, category: { in: ["Payroll", "Leave", "Attendance", "Entitlement", "Employee"] } } });
  await prisma.notification.createMany({
    data: [
      { tenantId, userId, title: "Payroll bulan ini siap direview", body: "Draft payroll karyawan demo sudah selesai dihitung.", category: "Payroll", priority: "high", status: "unread", actionUrl: "/portal/professional-services/hris/payroll", createdAt: addDays(now, 0) },
      { tenantId, userId, title: "Approval cuti menunggu", body: "Beberapa request cuti perlu diproses owner.", category: "Leave", priority: "high", status: "unread", actionUrl: "/portal/professional-services/hris/leave", createdAt: addDays(now, -1) },
      { tenantId, userId, title: "Sync attendance berhasil", body: "Log attendance terbaru masuk dari device kantor.", category: "Attendance", priority: "normal", status: "read", actionUrl: "/portal/professional-services/hris/attendance", createdAt: addDays(now, -2) },
      { tenantId, userId, title: "Data employee perlu review", body: "Beberapa employee belum melengkapi rekening dan NPWP.", category: "Employee", priority: "normal", status: "unread", actionUrl: "/portal/professional-services/hris/employees", createdAt: addDays(now, -3) }
    ]
  });
}

async function seedCampusDemo(prisma: PrismaClient, tenantId: string, branchId: string, employees: Employee[], now: Date) {
  const faculty = await prisma.campusFaculty.create({
    data: { tenantId, branchId, name: "Fakultas Ilmu Komputer", code: "FIK", deanName: "Dr. Budi Santoso" }
  });

  const program = await prisma.campusStudyProgram.create({
    data: { tenantId, branchId, facultyId: faculty.id, name: "Teknik Informatika", code: "TI", degree: "S1", headName: "Siti Aminah, M.Kom" }
  });

  const students = await Promise.all(
    ["Nadia", "Bagas", "Raka"].map((name, i) =>
      prisma.campusStudent.create({
        data: {
          tenantId,
          branchId,
          studyProgramId: program.id,
          nim: `240${i + 1}`,
          fullName: name,
          email: `${name.toLowerCase()}@mahasiswa.ac.id`,
          entryYear: 2024,
          currentSemester: 3,
          status: "active"
        }
      })
    )
  );

  const course1 = await prisma.campusCourse.create({
    data: { tenantId, branchId, studyProgramId: program.id, facultyId: faculty.id, code: "IF301", name: "Pemrograman Web Lanjut", credits: 3, semester: 3, lecturerName: "Rudi Hartono, M.T." }
  });
  const course2 = await prisma.campusCourse.create({
    data: { tenantId, branchId, studyProgramId: program.id, facultyId: faculty.id, code: "IF302", name: "Sistem Basis Data", credits: 3, semester: 3, lecturerName: "Andi Saputra, M.Kom" }
  });

  const class1 = await prisma.campusClass.create({
    data: { tenantId, branchId, courseId: course1.id, studyProgramId: program.id, name: "TI-3A", academicYear: "2024/2025", semester: "Ganjil", schedule: "Senin, 08:00 - 10:30", room: "Ruang 401" }
  });

  for (const student of students) {
    await prisma.campusEnrollment.create({
      data: { tenantId, branchId, classId: class1.id, studentId: student.id, status: "enrolled" }
    });
  }

  const assignment = await prisma.campusAssignment.create({
    data: { tenantId, branchId, classId: class1.id, title: "Tugas Akhir React", description: "Buat project React.js menggunakan Next.js.", dueDate: addDays(now, 7), status: "published" }
  });

  await prisma.campusSubmission.create({
    data: { tenantId, branchId, assignmentId: assignment.id, studentId: students[0].id, content: "https://github.com/nadia/tugas-react", score: 90, status: "graded", gradedAt: now }
  });

  const period = await prisma.campusKknPeriod.create({
    data: { tenantId, branchId, name: "KKN Tematik 2024", academicYear: "2024/2025", startDate: addDays(now, -30), endDate: addDays(now, 30), status: "active" }
  });

  const location = await prisma.campusKknLocation.create({
    data: { tenantId, branchId, name: "Desa Caman Raya", capacity: 20, status: "active" }
  });

  const kknGroup = await prisma.campusKknGroup.create({
    data: { tenantId, branchId, periodId: period.id, locationId: location.id, code: "CRB-01", supervisorName: "Dr. Budi Santoso", status: "active" }
  });

  for (const student of students) {
    await prisma.campusKknGroupMember.create({
      data: { groupId: kknGroup.id, studentId: student.id, role: "member" }
    });
  }

  await prisma.campusKknLogbook.create({
    data: { tenantId, branchId, groupId: kknGroup.id, date: now, activity: "Penyuluhan teknologi pertanian", status: "submitted" }
  });

  const req = await prisma.campusAcademicRequest.create({
    data: { tenantId, branchId, studentId: students[0].id, type: "Surat Keterangan Aktif", status: "submitted", owner: "BAAK" }
  });

  await prisma.campusAnnouncement.create({
    data: { tenantId, branchId, facultyId: faculty.id, title: "Jadwal KRS Semester Genap 2024/2025", body: "KRS dapat diakses mulai tanggal 15 Januari.", category: "Akademik", publishedAt: now }
  });
}
