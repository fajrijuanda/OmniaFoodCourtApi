import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { industries } from "./seed-data/industries";
import { seedPortalDemo } from "./seed-data/portal-demo";

const prisma = new PrismaClient();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const titleCase = (value: string) =>
  value
    .replace(/\.$/, "")
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      return ["AI", "API", "B2B", "CRM", "ERP", "F&B", "HR", "HRIS", "KDS", "POS", "QR", "SOP", "WA"].includes(upper)
        ? upper
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

const modulesFromOffer = (offer: string) =>
  offer
    .replace(/\.$/, "")
    .split(",")
    .map((item) => titleCase(item.trim()))
    .filter(Boolean)
    .slice(0, 8);

const tierNames = ["Starter", "Growth", "Pro", "Enterprise"];
const tierPrices = ["Rp499rb", "Rp1,5jt", "Rp3,5jt", "Mulai Rp7,5jt"];
const segmentTierPrices: Record<string, string[]> = {
  Cafe: ["Rp110rb", "Rp220rb", "Rp450rb", "Mulai Rp950rb"],
  Restoran: ["Rp190rb", "Rp390rb", "Rp790rb", "Mulai Rp1,5jt"],
  "E-Learning (LMS)": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"],
  "KKN & Fieldwork": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"],
  "Layanan Akademik": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"]
};
const hrisPackageTiers = [
  {
    baseTier: "Starter",
    name: "HRIS Starter Paket Hemat",
    price: "Rp 275.000/bulan/maks. 50 kryw",
    fit: "Diskon Rp 50.000 untuk tim sampai 50 karyawan.",
    limits: ["maks. 50 karyawan", "diskon Rp 50.000"]
  },
  {
    baseTier: "Growth",
    name: "HRIS Growth Paket Hemat",
    price: "Rp 320.000/bulan/maks. 50 kryw",
    fit: "Hemat 20% (-Rp 80.000) untuk tim sampai 50 karyawan.",
    limits: ["maks. 50 karyawan", "hemat 20%"]
  },
  {
    baseTier: "Pro",
    name: "HRIS Pro Paket Hemat",
    price: "Rp 450.000/bulan/maks. 50 kryw",
    fit: "Hemat 25% (-Rp 150.000) untuk tim sampai 50 karyawan.",
    limits: ["maks. 50 karyawan", "hemat 25%"]
  },
  {
    baseTier: "Starter",
    name: "HRIS Starter Paket Hemat+",
    price: "Rp 520.000/bulan/maks. 100 kryw",
    fit: "Hemat 20% (-Rp 130.000) + free slot 20 karyawan; Rp 4.333/HC.",
    limits: ["maks. 100 karyawan", "free slot 20 karyawan", "Rp 4.333/HC"]
  },
  {
    baseTier: "Growth",
    name: "HRIS Growth Paket Hemat+",
    price: "Rp 640.000/bulan/maks. 100 kryw",
    fit: "Hemat 20% (-Rp 160.000) + free slot 25 karyawan; Rp 5.120/HC.",
    limits: ["maks. 100 karyawan", "free slot 25 karyawan", "Rp 5.120/HC"]
  },
  {
    baseTier: "Pro",
    name: "HRIS Pro Paket Hemat+",
    price: "Rp 900.000/bulan/maks. 100 kryw",
    fit: "Hemat 25% (-Rp 300.000) + free slot 50 karyawan; Rp 6.000/HC.",
    limits: ["maks. 100 karyawan", "free slot 50 karyawan", "Rp 6.000/HC"]
  }
];
const expectedSubIndustryCount = industries.reduce((total, industry) => total + industry.segments.length, 0);
const industryRenames = [
  { from: "F&B / Restoran / Cafe", to: "F&B / Kuliner" }
];

const profile = [
  {
    description: "Untuk mulai digitalisasi workflow inti dan laporan dasar.",
    fit: "1 outlet, tim kecil, validasi awal.",
    limits: ["1 outlet", "1-3 user", "report dasar"]
  },
  {
    description: "Untuk tim aktif yang butuh workflow lengkap, dashboard, dan automation ringan.",
    fit: "Operasional mulai rutin pakai sistem.",
    limits: ["1 outlet", "hingga 8 user", "automation ringan"]
  },
  {
    description: "Untuk multi-role, cabang, approval, integrasi dasar, dan support prioritas.",
    fit: "Bisnis bertumbuh atau multi-cabang.",
    limits: ["multi-cabang", "hingga 25 user", "approval & integrasi"]
  },
  {
    description: "Untuk scope custom, SLA, database dedicated, dan integrasi kompleks.",
    fit: "Franchise, korporasi, atau data sensitif.",
    limits: ["custom outlet", "custom user", "database dedicated"]
  }
];

const cafeTierProfile = [
  {
    description: "Untuk kedai kopi kecil yang butuh kasir sederhana, menu dasar, dan riwayat transaksi harian.",
    fit: "Kedai kopi kecil, 1 outlet, owner merangkap kasir/barista.",
    limits: ["1 outlet", "1 kasir aktif", "menu & laporan dasar"]
  },
  {
    description: "Untuk cafe yang mulai ramai dan butuh order meja/QR, stok bahan sederhana, promo, dan closing shift.",
    fit: "Cafe kecil-menengah dengan transaksi harian rutin.",
    limits: ["1 outlet", "hingga 4 user", "QR order & inventory dasar"]
  },
  {
    description: "Untuk cafe bertumbuh yang butuh KDS/bar queue, dashboard owner, recipe costing, dan kontrol tim lebih rapi.",
    fit: "Cafe ramai, beberapa role operasional, atau persiapan outlet kedua.",
    limits: ["hingga 2 outlet", "hingga 10 user", "KDS & dashboard owner"]
  },
  {
    description: "Untuk jaringan cafe atau brand yang butuh multi-outlet, integrasi, SLA, dan penyesuaian workflow.",
    fit: "Multi-outlet, franchise awal, atau brand cafe dengan kebutuhan custom.",
    limits: ["custom outlet", "custom user", "integrasi & SLA"]
  }
];

const restaurantTierProfile = [
  {
    description: "Untuk restoran kecil yang butuh POS dine-in, menu, riwayat order, dan table management dasar.",
    fit: "Restoran kecil, warung modern, atau rumah makan 1 outlet.",
    limits: ["1 outlet", "1 kasir aktif", "meja & open bill dasar"]
  },
  {
    description: "Untuk restoran yang mulai ramai dan butuh reservasi, split bill, QR order, inventory dasar, dan closing shift.",
    fit: "Restoran dine-in aktif dengan waiter dan kasir terpisah.",
    limits: ["1 outlet", "hingga 6 user", "reservasi & inventory dasar"]
  },
  {
    description: "Untuk restoran bertumbuh yang butuh KDS multi-station, COGS, outlet report, role permission, dan kontrol operasional lebih lengkap.",
    fit: "Restoran ramai, multi-area, atau persiapan outlet kedua.",
    limits: ["hingga 2 outlet", "hingga 15 user", "KDS & COGS"]
  },
  {
    description: "Untuk grup restoran atau brand multi-outlet dengan kebutuhan integrasi, SLA, audit, dan workflow custom.",
    fit: "Multi-outlet, grup restoran, atau franchise restoran.",
    limits: ["custom outlet", "custom user", "integrasi & SLA"]
  }
];

const hrisTierProfile = [
  {
    description: "Untuk merapikan database karyawan, absensi, cuti, dan payroll sederhana.",
    fit: "Tim kecil yang mulai menata HR digital.",
    limits: ["tanpa batas karyawan", "1 admin HR", "1 lokasi kerja"]
  },
  {
    description: "Untuk HR aktif dengan approval cuti, lembur, payslip, dan dashboard bulanan.",
    fit: "Perusahaan kecil-menengah dengan proses HR rutin.",
    limits: ["tanpa batas karyawan", "3 admin/approver", "multi shift"]
  },
  {
    description: "Untuk multi-divisi, approval berjenjang, payroll rule lebih kompleks, dan integrasi dasar.",
    fit: "Perusahaan bertumbuh dengan beberapa lokasi/divisi.",
    limits: ["tanpa batas karyawan", "multi lokasi/divisi", "approval berjenjang"]
  },
  {
    description: "Untuk jumlah karyawan custom, SLA, database dedicated, SSO/API, dan integrasi payroll kompleks.",
    fit: "Korporasi atau data karyawan sensitif.",
    limits: ["custom karyawan", "SSO/API payroll", "database dedicated"]
  }
];

const restaurantFeatureNames = [
  "Core workflow sub-industri",
  "Resto POS",
  "Menu POS",
  "Riwayat order",
  "Table management dasar",
  "Open bill",
  "QR/table order",
  "Reservasi",
  "Split bill",
  "Kitchen Display / KDS",
  "Inventory bahan",
  "COGS / recipe costing",
  "Pajak & service charge",
  "Outlet report",
  "Role permission & approval",
  "Reminder / automation",
  "Audit log",
  "SLA & priority support",
  "Database dedicated"
];

const hrisFeatureNames = [
  "Database Karyawan Tanpa Batas",
  "AI Face Recognition & Liveness Attendance",
  "Geofencing & Multiple Work Locations",
  "Manajemen Cuti & Izin Berjenjang",
  "Field Report & Reimbursement Automation",
  "Payroll Otomatis (PPh21 & BPJS)",
  "Dynamic KPI & Performance Review",
  "Recruitment & Applicant Tracking (ATS)",
  "Multi-branch & Multi-role Permission",
  "WhatsApp & Email Automation (Sistem Kuota)",
  "Export Laporan & Audit Log Lengkap",
  "SLA & Dedicated Priority Support"
];

const lmsFeatureNames = [
  "Core workflow sub-industri",
  "Campus Dashboard",
  "E-Learning / LMS",
  "Course & Class Management",
  "Assignment & Submission",
  "Attendance & Gradebook",
  "Lecturer & Advisor Portal",
  "Integration Center",
  "Role permission & approval",
  "Dashboard pimpinan & KPI",
  "Reminder / automation",
  "Audit log",
  "SLA & priority support",
  "Database dedicated"
];

const kknFeatureNames = [
  "Core workflow sub-industri",
  "Campus Dashboard",
  "KKN / Fieldwork Management",
  "Location Plotting",
  "Student Grouping",
  "Logbook & Timeline",
  "Final Report Review",
  "Integration Center",
  "Role permission & approval",
  "Dashboard pimpinan & KPI",
  "Reminder / automation",
  "Audit log",
  "SLA & priority support",
  "Database dedicated"
];

const academicFeatureNames = [
  "Core workflow sub-industri",
  "Campus Dashboard",
  "Academic Services / SIPT Portal",
  "Request Queues",
  "Document Repository",
  "Approval Workflow Inbox",
  "Billing & Payment Kasir",
  "Report & Analytics",
  "Integration Center",
  "Role permission & approval",
  "Dashboard pimpinan & KPI",
  "Reminder / automation",
  "Audit log",
  "SLA & priority support",
  "Database dedicated"
];

const higherEducationTierProfile = [
  {
    description: "Portal dasar mahasiswa, data akademik awal, pengumuman, dan modul ringan.",
    fit: "Kampus kecil, fakultas, prodi, atau unit yang mulai digitalisasi.",
    limits: ["1 unit", "250 mahasiswa aktif", "15 user staff/dosen"]
  },
  {
    description: "Modul lengkap, dashboard, operasional rutin, dan kontrol laporan.",
    fit: "Kampus atau fakultas yang menjalankan layanan mahasiswa rutin.",
    limits: ["3 prodi", "1.500 mahasiswa aktif", "50 user staff/dosen"]
  },
  {
    description: "Multi-fakultas, dashboard pimpinan, audit, dan integrasi API.",
    fit: "Kampus multi-fakultas yang butuh portal terpadu.",
    limits: ["multi-fakultas", "10.000 mahasiswa", "250 user staff/dosen"]
  },
  {
    description: "Multi kampus, database dedicated, SSO, integrasi kompleks, dan SLA.",
    fit: "Universitas besar, multi-kampus, atau data sensitif.",
    limits: ["custom unit", "custom mahasiswa", "database dedicated"]
  }
];

const addOnCatalog = [
  {
    slug: "hris-lite",
    name: "HRIS Lite",
    category: "People Ops",
    complexity: "Sedang",
    price: "Mulai Rp150rb",
    amount: 150000,
    description: "Employee directory, attendance sederhana, leave request, dan payroll export ringan.",
    bestFor: "Owner F&B/clinic/church yang mulai punya shift tim tetap.",
    recommendedFor: ["Cafe", "Restoran", "Klinik Umum", "Gereja"],
    sourceApp: "HRIS"
  },
  {
    slug: "advanced-payroll",
    name: "Advanced Payroll",
    category: "People Ops",
    complexity: "Tinggi",
    price: "Mulai Rp250rb",
    amount: 250000,
    description: "Komponen gaji, potongan, reimbursement, payslip, dan kontrol payroll multi-cabang.",
    bestFor: "Bisnis dengan skema gaji/insentif lebih kompleks.",
    recommendedFor: ["Restoran", "Klinik Umum", "Church Enterprise", "HRIS"],
    sourceApp: "HRIS"
  },
  {
    slug: "clinic-pharmacy",
    name: "Clinic Pharmacy",
    category: "Health",
    complexity: "Tinggi",
    price: "Mulai Rp300rb",
    amount: 300000,
    description: "Stok obat, e-resep, batch/expiry, purchase order, dan mutasi farmasi untuk klinik.",
    bestFor: "Klinik umum yang menjual obat sendiri tanpa perlu aplikasi pharmacy penuh.",
    recommendedFor: ["Klinik Umum", "Klinik Gigi", "Klinik Kecantikan"],
    sourceApp: "Pharmacy"
  },
  {
    slug: "inventory-advanced",
    name: "Inventory Advanced",
    category: "Operations",
    complexity: "Tinggi",
    price: "Mulai Rp220rb",
    amount: 220000,
    description: "Recipe costing, stok bahan, stock opname, purchase request, dan alert stok minimum.",
    bestFor: "F&B dan clinic yang butuh kontrol bahan/obat lebih rapi.",
    recommendedFor: ["Cafe", "Restoran", "Klinik Umum", "Bakery"],
    sourceApp: "F&B POS"
  },
  {
    slug: "customer-loyalty",
    name: "Customer Loyalty",
    category: "Growth",
    complexity: "Sedang",
    price: "Mulai Rp180rb",
    amount: 180000,
    description: "Profil pelanggan, poin/member, voucher, reminder, dan campaign ringan.",
    bestFor: "Cafe/restoran/clinic yang ingin menaikkan repeat order atau kunjungan ulang.",
    recommendedFor: ["Cafe", "Restoran", "Klinik Kecantikan", "Salon"],
    sourceApp: "CRM"
  },
  {
    slug: "whatsapp-automation",
    name: "WhatsApp Automation",
    category: "Automation",
    complexity: "Sedang",
    price: "Mulai Rp200rb",
    amount: 200000,
    description: "Template reminder, follow-up pembayaran, appointment, order ready, dan broadcast tersegmentasi.",
    bestFor: "Bisnis dengan komunikasi customer berulang.",
    recommendedFor: ["Klinik Umum", "Cafe", "Restoran", "Gereja"],
    sourceApp: "Automation"
  },
  {
    slug: "finance-lite",
    name: "Finance Lite",
    category: "Finance",
    complexity: "Sedang",
    price: "Mulai Rp180rb",
    amount: 180000,
    description: "Kas masuk/keluar, expense, invoice sederhana, closing kas, dan laporan margin.",
    bestFor: "Owner yang ingin laporan keuangan operasional tanpa sistem akuntansi penuh.",
    recommendedFor: ["Cafe", "Restoran", "Church", "Klinik Umum"],
    sourceApp: "Finance"
  },
  {
    slug: "multi-branch-control",
    name: "Multi-Branch Control",
    category: "Operations",
    complexity: "Tinggi",
    price: "Mulai Rp350rb",
    amount: 350000,
    description: "Branch permission, outlet dashboard, transfer stok/cabang, dan konsolidasi laporan.",
    bestFor: "Bisnis yang mulai membuka cabang kedua dan butuh kontrol pusat.",
    recommendedFor: ["Cafe", "Restoran", "Klinik Umum", "Retail"],
    sourceApp: "Core Platform"
  }
];

const clinicTierProfile = [
  {
    description: "Operasional klinik dasar: pasien, appointment, antrean, poli, dan notifikasi internal.",
    fit: "Klinik tunggal yang baru merapikan pendaftaran dan antrean.",
    limits: ["1 cabang", "pasien + appointment", "antrean + poli dasar"]
  },
  {
    description: "Workflow klinis harian dengan multi-branch dasar, nurse station, kunjungan, SOAP, e-resep, dan reminder.",
    fit: "Klinik aktif yang mulai butuh SIMRS ringan.",
    limits: ["multi-branch dasar", "SIMRS dasar", "reminder + export CSV"]
  },
  {
    description: "Operasional lengkap klinik: farmasi, POS, keuangan, permission detail, audit, dan dashboard owner.",
    fit: "Klinik bertumbuh atau multi-cabang yang butuh kontrol owner.",
    limits: ["farmasi + POS", "keuangan klinik", "audit + dashboard owner"]
  },
  {
    description: "Enterprise KlinikOps untuk cabang kompleks, lab mailbox, SatuSehat-ready sync, advanced audit, backup, dan integrasi custom.",
    fit: "Jaringan klinik, korporasi, atau kebutuhan integrasi/regulasi tinggi.",
    limits: ["multi-branch advanced", "SatuSehat-ready", "custom integration + SLA"]
  }
];

const users = [
  { email: "admin@omnia.local", password: "Admin123!", name: "Admin Omnia", role: UserRole.super_admin },
  { email: "owner@omnia.local", password: "Owner123!", name: "Owner Demo", role: UserRole.owner },
  { email: "employee@omnia.local", password: "Employee123!", name: "Employee Demo", role: UserRole.employee }
];

async function seedUsers() {
  const seedDemoData = process.env.SEED_DEMO_DATA === "true";
  const usersToSeed = seedDemoData ? users : users.filter((user) => user.role === UserRole.super_admin);

  for (const user of usersToSeed) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        status: "active",
        passwordHash
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        status: "active",
        passwordHash
      }
    });
  }
}

async function normalizeIndustryNames() {
  for (const rename of industryRenames) {
    await prisma.industry.updateMany({
      where: { name: rename.from },
      data: { name: rename.to }
    });
  }
}

async function resetCatalogIfIncomplete() {
  const [industryCount, subIndustryCount] = await Promise.all([
    prisma.industry.count(),
    prisma.subIndustry.count()
  ]);

  if (industryCount === industries.length && subIndustryCount === expectedSubIndustryCount) {
    await normalizeIndustryNames();
    console.log("Catalog already seeded, skipping catalog seed.");
    return false;
  }

  await prisma.$transaction([
    prisma.tierFeature.deleteMany(),
    prisma.tier.deleteMany(),
    prisma.feature.deleteMany(),
    prisma.subIndustry.deleteMany(),
    prisma.industry.deleteMany()
  ]);
  return true;
}

async function seedCatalog() {
  const shouldSeed = await resetCatalogIfIncomplete();
  if (!shouldSeed) return;

  for (const [industryIndex, industry] of industries.entries()) {
    const savedIndustry = await prisma.industry.create({
      data: {
        name: industry.name,
        slug: slugify(industry.name),
        iconKey: industry.icon,
        colorKey: industry.color,
        pain: industry.pain,
        solution: industry.solution,
        sortOrder: industryIndex,
        isActive: true
      }
    });

    for (const [segmentIndex, segment] of industry.segments.entries()) {
      const subSlug = `${slugify(industry.name)}-${slugify(segment.name)}`;
      const savedSub = await prisma.subIndustry.create({
        data: {
          industryId: savedIndustry.id,
          name: segment.name,
          slug: subSlug,
          need: segment.need,
          offer: segment.offer,
          sortOrder: segmentIndex,
          isActive: true
        }
      });

      const isClinicOps = industry.name.toLowerCase().includes("klinik") || industry.name.toLowerCase().includes("kesehatan");
      const isCafe = industry.name === "F&B / Kuliner" && segment.name === "Cafe";
      const isRestaurant = industry.name === "F&B / Kuliner" && segment.name === "Restoran";
      const clinicFeatureNames = [
        "Dashboard KlinikOps dasar",
        "Branch tunggal",
        "Master pasien",
        "Appointment/jadwal pasien",
        "Antrean dan queue display",
        "Master poli/layanan dasar",
        "Role dasar owner/admin/staff",
        "Notifikasi internal dasar",
        "Multi-branch dasar",
        "Nurse station",
        "Kunjungan pasien",
        "Pemeriksaan klinis dasar",
        "E-resep sederhana",
        "Riwayat tindakan",
        "Reminder appointment/follow-up",
        "Export CSV dasar",
        "Farmasi stok dan PO",
        "POS/kasir klinik",
        "Keuangan klinik",
        "Permission matrix detail",
        "Audit log operasional",
        "Dashboard owner lintas cabang",
        "Transfer pasien antar cabang",
        "Lab mailbox/vendor integration",
        "SatuSehat-ready sync",
        "Advanced audit/export",
        "Backup/maintenance controls",
        "Custom integration dan SLA"
      ];
      const isHRIS = segment.name === "HRIS";
      const isLms = segment.name === "E-Learning (LMS)";
      const isKkn = segment.name === "KKN & Fieldwork";
      const isAcademic = segment.name === "Layanan Akademik";
      const isHigherEducation = isLms || isKkn || isAcademic;
      const featureNames = isClinicOps
        ? clinicFeatureNames
        : isRestaurant
          ? restaurantFeatureNames
          : isHRIS
            ? hrisFeatureNames
            : isLms
              ? lmsFeatureNames
              : isKkn
                ? kknFeatureNames
                : isAcademic
                  ? academicFeatureNames
                  : Array.from(new Set(["Core workflow sub-industri", ...modulesFromOffer(segment.offer), "Role permission & approval", "Owner dashboard & KPI", "Reminder / automation", "Audit log"]));
      await prisma.feature.createMany({
        data: featureNames.map((featureName, featureIndex) => ({
          subIndustryId: savedSub.id,
          name: featureName,
          sortOrder: featureIndex,
          isActive: true
        }))
      });

      const hrisTierPrices = ["Rp6.500/karyawan", "Rp8.000/karyawan", "Rp12.000/karyawan", "Rp18.000/karyawan"];
      const hrisTierCadences = ["/ bulan", "/ bulan", "/ bulan", "/ bulan"];
      const prices = segmentTierPrices[segment.name] ?? tierPrices;
      const tierProfile = isClinicOps ? clinicTierProfile : isCafe ? cafeTierProfile : isRestaurant ? restaurantTierProfile : segment.name === "HRIS" ? hrisTierProfile : isHigherEducation ? higherEducationTierProfile : profile;
      
      await prisma.tier.createMany({
        data: tierNames.map((tierName, tierIndex) => ({
          subIndustryId: savedSub.id,
          name: `${segment.name} ${tierName}`,
          slug: `${subSlug}-${slugify(tierName)}`,
          price: segment.name === "HRIS" ? hrisTierPrices[tierIndex] : prices[tierIndex],
          cadence: segment.name === "HRIS" ? hrisTierCadences[tierIndex] : "/ bulan",
          description: tierProfile[tierIndex].description,
          fit: tierProfile[tierIndex].fit,
          limitsJson: tierProfile[tierIndex].limits,
          sortOrder: tierIndex,
          highlight: tierName === "Growth",
          isActive: true
        }))
      });

      const [features, tiers] = await Promise.all([
        prisma.feature.findMany({ where: { subIndustryId: savedSub.id }, orderBy: { sortOrder: "asc" } }),
        prisma.tier.findMany({ where: { subIndustryId: savedSub.id }, orderBy: { sortOrder: "asc" } })
      ]);

      await prisma.tierFeature.createMany({
        data: tiers.flatMap((tier, tierIndex) => {
          const includedLimit = isClinicOps
            ? tierIndex === 0 ? 8 : tierIndex === 1 ? 16 : tierIndex === 2 ? 22 : features.length
            : isCafe
              ? tierIndex === 0 ? 2 : tierIndex === 1 ? 5 : tierIndex === 2 ? 8 : features.length
              : isRestaurant
                ? tierIndex === 0 ? 5 : tierIndex === 1 ? 10 : tierIndex === 2 ? 15 : features.length
                  : isHRIS
                    ? tierIndex === 0 ? 4 : tierIndex === 1 ? 8 : tierIndex === 2 ? 10 : features.length
                    : isHigherEducation
                      ? tierIndex === 0 ? 5 : tierIndex === 1 ? 9 : tierIndex === 2 ? 12 : features.length
            : tierIndex === 0 ? 4 : tierIndex === 1 ? 7 : tierIndex === 2 ? 9 : features.length;
          return features.map((feature, featureIndex) => ({
            tierId: tier.id,
            featureId: feature.id,
            included: featureIndex < includedLimit
          }));
        })
      });
    }
  }
}

async function syncSegmentTierOverrides() {
  const overrides = [
    { name: "Cafe", prices: segmentTierPrices.Cafe, profiles: cafeTierProfile, includedLimits: [2, 5, 8] },
    { name: "Restoran", prices: segmentTierPrices.Restoran, profiles: restaurantTierProfile, includedLimits: [5, 10, 15] }
  ];

  for (const override of overrides) {
    const subIndustry = await prisma.subIndustry.findFirst({
      where: { name: override.name, industry: { name: "F&B / Kuliner" } },
      include: {
        features: { orderBy: { sortOrder: "asc" } },
        tiers: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!subIndustry) continue;

    for (const [tierIndex, tier] of subIndustry.tiers.entries()) {
      const tierProfile = override.profiles[tierIndex] ?? override.profiles[override.profiles.length - 1];
      const includedLimit = override.includedLimits[tierIndex] ?? subIndustry.features.length;
      await prisma.tier.update({
        where: { id: tier.id },
        data: {
          price: override.prices[tierIndex],
          description: tierProfile.description,
          fit: tierProfile.fit,
          limitsJson: tierProfile.limits
        }
      });

      for (const [featureIndex, feature] of subIndustry.features.entries()) {
        await prisma.tierFeature.upsert({
          where: { tierId_featureId: { tierId: tier.id, featureId: feature.id } },
          update: { included: featureIndex < includedLimit },
          create: {
            tierId: tier.id,
            featureId: feature.id,
            included: featureIndex < includedLimit
          }
        });
      }
    }
  }
}

async function syncHrisPackageTiers() {
  const hris = await prisma.subIndustry.findFirst({
    where: { name: "HRIS" },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      tiers: { include: { tierFeatures: true }, orderBy: { sortOrder: "asc" } }
    }
  });
  if (!hris) return;

  await prisma.tier.updateMany({
    where: { subIndustryId: hris.id, name: { contains: "Enterprise", mode: "insensitive" } },
    data: { sortOrder: 99 }
  });

  for (const [index, packageTier] of hrisPackageTiers.entries()) {
    const baseTier = hris.tiers.find((tier) => tier.name.toLowerCase().includes(packageTier.baseTier.toLowerCase()) && !tier.name.toLowerCase().includes("paket hemat"));
    const slug = `${hris.slug}-${slugify(packageTier.name.replace(/^HRIS\s+/i, ""))}`;
    const tier = await prisma.tier.upsert({
      where: { slug },
      update: {
        name: packageTier.name,
        price: packageTier.price,
        cadence: "/ bulan",
        description: baseTier?.description ?? "Paket hemat HRIS untuk kebutuhan operasional tim.",
        fit: packageTier.fit,
        limitsJson: packageTier.limits,
        sortOrder: 10 + index,
        highlight: packageTier.name.includes("Growth Paket Hemat+"),
        isActive: true
      },
      create: {
        subIndustryId: hris.id,
        name: packageTier.name,
        slug,
        price: packageTier.price,
        cadence: "/ bulan",
        description: baseTier?.description ?? "Paket hemat HRIS untuk kebutuhan operasional tim.",
        fit: packageTier.fit,
        limitsJson: packageTier.limits,
        sortOrder: 10 + index,
        highlight: packageTier.name.includes("Growth Paket Hemat+"),
        isActive: true
      }
    });

    for (const feature of hris.features) {
      const baseFeature = baseTier?.tierFeatures.find((item) => item.featureId === feature.id);
      await prisma.tierFeature.upsert({
        where: { tierId_featureId: { tierId: tier.id, featureId: feature.id } },
        update: { included: Boolean(baseFeature?.included) },
        create: { tierId: tier.id, featureId: feature.id, included: Boolean(baseFeature?.included) }
      });
    }
  }
}

async function seedAddOnCatalog() {
  for (const [index, addOn] of addOnCatalog.entries()) {
    await prisma.addOn.upsert({
      where: { slug: addOn.slug },
      update: {
        name: addOn.name,
        category: addOn.category,
        complexity: addOn.complexity,
        price: addOn.price,
        amount: addOn.amount,
        cadence: "/ bulan",
        description: addOn.description,
        bestFor: addOn.bestFor,
        recommendedFor: addOn.recommendedFor,
        sourceApp: addOn.sourceApp,
        sortOrder: index,
        isActive: true
      },
      create: {
        slug: addOn.slug,
        name: addOn.name,
        category: addOn.category,
        complexity: addOn.complexity,
        price: addOn.price,
        amount: addOn.amount,
        cadence: "/ bulan",
        description: addOn.description,
        bestFor: addOn.bestFor,
        recommendedFor: addOn.recommendedFor,
        sourceApp: addOn.sourceApp,
        sortOrder: index,
        isActive: true
      }
    });
  }
}

async function main() {
  await seedUsers();
  await seedCatalog();
  await syncSegmentTierOverrides();
  await syncHrisPackageTiers();
  await seedAddOnCatalog();

  if (process.env.SEED_DEMO_DATA === "true") {
    await seedPortalDemo(prisma);
  } else {
    console.log("Skipping portal demo seed. Set SEED_DEMO_DATA=true to seed demo workspace data.");
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
