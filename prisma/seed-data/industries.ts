export type IndustrySegment = {
  name: string;
  need: string;
  offer: string;
};

export type Industry = {
  name: string;
  icon: string;
  pain: string;
  solution: string;
  color:
    | "food-orange"
    | "health-blue"
    | "retail-green"
    | "commerce-pink"
    | "education-purple"
    | "professional-cyan"
    | "distribution-indigo"
    | "manufacturing-teal"
    | "property-violet"
    | "franchise-amber"
    | "event-rose"
    | "public-sky";
  segments: IndustrySegment[];
};

export const industries: Industry[] = [
  {
    name: "F&B / Kuliner",
    icon: "Utensils",
    pain: "Kasir, stok bahan, shift crew, dan performa outlet tidak tersambung.",
    solution: "POS F&B, menu digital, inventory bahan, kitchen flow, dan outlet dashboard.",
    color: "food-orange",
    segments: [
      { name: "Cafe", need: "Menu, meja, kasir, loyalty, dan performa barista.", offer: "Cafe POS, table order, loyalty, daily sales dashboard." },
      { name: "Restoran", need: "Dine-in, reservasi, kitchen order, dan service charge.", offer: "Reservation, KDS, table management, split bill, outlet report." },
      { name: "Cloud Kitchen", need: "Order aggregator, produksi, stok bahan, dan delivery.", offer: "Order hub, recipe costing, inventory bahan, delivery status." },
      { name: "Bakery", need: "Produksi harian, batch, pre-order, dan stok display.", offer: "Production plan, batch stock, pre-order, waste report." },
      { name: "Food Court", need: "Banyak tenant, settlement, laporan tenant, dan promo.", offer: "Tenant POS, settlement report, promo rules, admin dashboard." }
    ]
  },
  {
    name: "Kesehatan & Klinik",
    icon: "Stethoscope",
    pain: "Pendaftaran, rekam medis, farmasi, kasir, dan laporan masih terpisah.",
    solution: "KlinikOps, booking pasien, farmasi, kasir, reminder, dan dashboard owner.",
    color: "health-blue",
    segments: [
      { name: "Klinik Umum", need: "Antrian, rekam medis, resep, dan kasir.", offer: "KlinikOps, patient booking, e-resep, billing, dashboard dokter." },
      { name: "Dental Clinic", need: "Jadwal dokter, odontogram, tindakan, dan follow-up.", offer: "Dental booking, chart gigi, treatment plan, reminder kontrol." },
      { name: "Klinik Kecantikan", need: "Treatment, paket member, stok produk, dan repeat visit.", offer: "Treatment CRM, membership, POS produk, reminder perawatan." },
      { name: "Veterinary Clinic", need: "Data hewan, vaksin, grooming, obat, dan owner reminder.", offer: "Pet profile, vaccine schedule, booking, farmasi, WhatsApp reminder." },
      { name: "Apotek", need: "Stok obat, expiry date, kasir, dan laporan penjualan.", offer: "POS apotek, expiry alert, inventory, supplier order, report." }
    ]
  },
  {
    name: "Retail & Toko",
    icon: "Store",
    pain: "Transaksi, stok, retur, dan laporan cabang sulit dipantau real-time.",
    solution: "POS, inventory, katalog produk, loyalty, dan laporan multi-cabang.",
    color: "retail-green",
    segments: [
      { name: "Minimarket", need: "Kasir cepat, stok rak, barcode, dan shift cashier.", offer: "POS barcode, shift report, stock opname, promo engine." },
      { name: "Toko Bangunan", need: "Varian ukuran, harga grosir, hutang piutang, dan delivery.", offer: "Inventory varian, customer pricing, invoice, delivery tracking." },
      { name: "Fashion Store", need: "Ukuran, warna, katalog online, dan stok cabang.", offer: "SKU matrix, omnichannel catalog, POS, multi-branch stock." },
      { name: "Toko Elektronik", need: "Serial number, garansi, retur, dan service claim.", offer: "Serial tracking, warranty module, return flow, service ticket." },
      { name: "Retail Apotek", need: "Penjualan obat bebas, stok, supplier, dan expiry.", offer: "POS retail, batch tracking, expiry alert, supplier dashboard." }
    ]
  },
  {
    name: "E-Commerce & Marketplace",
    icon: "ShoppingBag",
    pain: "Order, pembayaran, pengiriman, katalog, dan customer service tersebar.",
    solution: "Online store, payment gateway, order management, CRM, dan chatbot.",
    color: "commerce-pink",
    segments: [
      { name: "Brand D2C", need: "Store sendiri, checkout, promo, dan customer retention.", offer: "D2C storefront, payment, voucher, CRM, email/WA follow-up." },
      { name: "Fashion Online", need: "Varian produk, size chart, campaign, dan retur.", offer: "Catalog varian, size guide, campaign page, return request." },
      { name: "Beauty Store", need: "Bundle, membership, review, dan repeat order.", offer: "Bundle product, membership, review widget, reorder automation." },
      { name: "Elektronik", need: "Garansi, spesifikasi, pre-order, dan stok terbatas.", offer: "Spec catalog, warranty info, pre-order, stock notification." },
      { name: "Produk Digital", need: "Akses otomatis, invoice, lisensi, dan support.", offer: "Digital checkout, auto delivery, license key, helpdesk." },
      {
        name: "Social Commerce Intelligence",
        need: "Sinyal produk, creator, live, ads, dan kompetitor tersebar di banyak marketplace.",
        offer: "Product radar, creator signal, competitor watchlist, connector status, alert center, action cards."
      }
    ]
  },
  {
    name: "Pendidikan & Kursus",
    icon: "GraduationCap",
    pain: "Pendaftaran, jadwal kelas, presensi, pembayaran, dan progress siswa manual.",
    solution: "LMS ringan, booking kelas, student portal, invoice, dan dashboard akademik.",
    color: "education-purple",
    segments: [
      { name: "Bimbel", need: "Jadwal kelas, presensi, pembayaran, dan report orang tua.", offer: "Class schedule, attendance, billing, parent progress report." },
      { name: "Kursus Bahasa", need: "Level siswa, placement test, kelas, dan sertifikat.", offer: "Placement test, level tracking, class booking, certificate." },
      { name: "Bootcamp", need: "Batch, mentor, assignment, progress, dan placement.", offer: "Cohort portal, task submission, mentor dashboard, career tracker." },
      { name: "Sekolah", need: "PPDB, data siswa, pengumuman, dan pembayaran.", offer: "Admission portal, student data, announcement, invoice module." },
      { name: "Training Center", need: "Registrasi, jadwal trainer, materi, dan evaluasi.", offer: "Training registration, trainer schedule, material portal, feedback form." },
      { name: "E-Learning (LMS)", need: "LMS, presensi, nilai, materi, dan tugas.", offer: "Campus LMS, Courses, Assignments, Attendance, Gradebook." },
      { name: "KKN & Fieldwork", need: "Plotting lokasi, kelompok KKN, logbook, dan laporan.", offer: "KKN Groups, Locations, Logbook, Reports." },
      { name: "Layanan Akademik", need: "Pengajuan surat, approval, repositori dokumen, dan billing.", offer: "Academic Requests, Documents, Approvals, Billing." }
    ]
  },
  {
    name: "Jasa Profesional",
    icon: "BriefcaseBusiness",
    pain: "Lead masuk tidak rapi, proposal manual, jadwal tim, dan dokumen client tercecer.",
    solution: "Website, CRM, booking konsultasi, client portal, ticketing, dan automation.",
    color: "professional-cyan",
    segments: [
      { name: "Konsultan", need: "Lead, proposal, milestone, dan dokumen client.", offer: "Consulting CRM, proposal tracker, client portal, milestone board." },
      { name: "Law Firm", need: "Intake client, jadwal sidang, dokumen, dan billing.", offer: "Legal intake, case tracker, document vault, billing report." },
      { name: "Agency", need: "Brief, task, approval creative, dan laporan campaign.", offer: "Client brief, project board, approval flow, campaign dashboard." },
      { name: "HRIS", need: "Data karyawan, absensi, cuti, payroll, dan approval HR belum tersentralisasi.", offer: "Attendance & GPS, Leave approval, Payroll & payslip, Advanced payroll, Reimbursement, Field report, Performance KPI, ATS recruitment." },
      { name: "Arsitek", need: "Portfolio, consultation booking, revisi desain, dan file.", offer: "Portfolio site, booking, revision tracker, file handover portal." },
      { name: "Kantor Akuntan", need: "Dokumen client, deadline pajak, approval, dan invoice.", offer: "Client document portal, deadline reminder, approval, invoice." }
    ]
  },
  {
    name: "Distribusi & Supplier",
    icon: "Truck",
    pain: "Order B2B, stok gudang, sales lapangan, dan penagihan sering terlambat.",
    solution: "Portal supplier, sales order, inventory gudang, invoice, dan laporan rute.",
    color: "distribution-indigo",
    segments: [
      { name: "FMCG", need: "Sales order, rute, stok gudang, dan target sales.", offer: "Sales app, route plan, warehouse stock, sales dashboard." },
      { name: "Farmasi", need: "Batch, expiry, compliance, dan order apotek.", offer: "Batch tracking, expiry alert, B2B order portal, compliance report." },
      { name: "Bahan Bangunan", need: "Harga grosir, delivery, invoice, dan piutang.", offer: "B2B pricing, delivery schedule, invoice, receivable tracker." },
      { name: "Sparepart", need: "SKU banyak, kompatibilitas, stok, dan retur.", offer: "SKU search, compatibility notes, stock sync, return flow." },
      { name: "Grosir", need: "Member price, minimum order, pembayaran, dan pickup.", offer: "Wholesale portal, MOQ rules, payment tracking, pickup schedule." }
    ]
  },
  {
    name: "Manufaktur Ringan",
    icon: "Factory",
    pain: "Produksi, bahan baku, QC, costing, dan delivery tidak punya satu sumber data.",
    solution: "MRP ringan, work order, QC checklist, inventory, dan dashboard produksi.",
    color: "manufacturing-teal",
    segments: [
      { name: "Konveksi", need: "Order custom, bahan, ukuran, produksi, dan QC.", offer: "Work order, material usage, size matrix, QC checklist." },
      { name: "Furniture", need: "Design order, bahan, timeline, produksi, dan delivery.", offer: "Custom order, BOM, production timeline, delivery tracker." },
      { name: "Percetakan", need: "Prepress, approval desain, antrian produksi, dan invoice.", offer: "Design approval, job queue, print status, billing." },
      { name: "Makanan Kemasan", need: "Batch produksi, expiry, QC, dan distribusi.", offer: "Batch production, expiry tracking, QC log, distribution report." },
      { name: "Workshop", need: "Service order, sparepart, teknisi, dan status pekerjaan.", offer: "Service order, parts inventory, technician schedule, job status." }
    ]
  },
  {
    name: "Properti & Real Estate",
    icon: "Building2",
    pain: "Listing, lead buyer, follow-up agent, booking unit, dan dokumen sulit dilacak.",
    solution: "Website listing, CRM properti, booking unit, agent dashboard, dan document flow.",
    color: "property-violet",
    segments: [
      { name: "Developer", need: "Listing unit, lead, booking fee, dan progres dokumen.", offer: "Property listing, CRM, unit booking, document pipeline." },
      { name: "Broker", need: "Inventory listing, agent, follow-up buyer, dan komisi.", offer: "Listing CRM, agent dashboard, buyer follow-up, commission report." },
      { name: "Kost", need: "Kamar kosong, booking, pembayaran, dan keluhan penghuni.", offer: "Room availability, booking, tenant billing, complaint ticket." },
      { name: "Apartemen", need: "Unit, tenant, tagihan, maintenance, dan pengumuman.", offer: "Tenant portal, billing, maintenance ticket, announcement." },
      { name: "Property Management", need: "Vendor, work order, inspeksi, dan laporan owner.", offer: "Vendor portal, work order, inspection checklist, owner report." }
    ]
  },
  {
    name: "Franchise & Kemitraan",
    icon: "Network",
    pain: "Lead investor, performa outlet, SOP, dan monitoring cabang belum terpadu.",
    solution: "Franchise listing, CRM investor, POS outlet, training portal, dan dashboard cabang.",
    color: "franchise-amber",
    segments: [
      { name: "F&B Franchise", need: "Outlet sales, bahan baku, SOP, dan quality control.", offer: "Outlet POS, raw material order, SOP portal, QC visit." },
      { name: "Laundry", need: "Order kiloan, status cucian, cabang, dan komplain.", offer: "Laundry POS, order status, branch dashboard, complaint ticket." },
      { name: "Retail Franchise", need: "Stok outlet, transfer barang, promo, dan royalty.", offer: "Inventory outlet, transfer stock, promo rules, royalty report." },
      { name: "Education Franchise", need: "Siswa cabang, kelas, materi, dan performa tutor.", offer: "Student portal, class module, material hub, tutor report." },
      { name: "Kemitraan Brand", need: "Lead mitra, onboarding, dokumen, dan monitoring.", offer: "Partner CRM, onboarding checklist, document portal, performance dashboard." }
    ]
  },
  {
    name: "Event & Komunitas",
    icon: "CalendarDays",
    pain: "Registrasi, ticketing, check-in, sponsor, dan engagement peserta dikelola manual.",
    solution: "Event website, ticketing, QR check-in, email/WA reminder, dan member portal.",
    color: "event-rose",
    segments: [
      { name: "Seminar", need: "Registrasi, tiket, reminder, dan sertifikat.", offer: "Event page, ticketing, WhatsApp reminder, certificate generator." },
      { name: "Workshop", need: "Kuota peserta, materi, tugas, dan feedback.", offer: "Registration, material portal, assignment, feedback form." },
      { name: "Expo", need: "Tenant, booth, visitor, sponsor, dan check-in.", offer: "Exhibitor portal, booth map, QR check-in, sponsor dashboard." },
      { name: "Komunitas", need: "Member, event rutin, iuran, dan engagement.", offer: "Member portal, event calendar, dues tracking, community broadcast." },
      { name: "Event Organizer", need: "Client, vendor, rundown, budget, dan task crew.", offer: "Project board, vendor list, rundown planner, budget tracker." }
    ]
  },
  {
    name: "Layanan Publik",
    icon: "Landmark",
    pain: "Pelayanan warga, pengajuan surat, informasi publik, dan laporan masih lambat.",
    solution: "Portal layanan, pengajuan online, tracking status, dashboard, dan arsip digital.",
    color: "public-sky",
    segments: [
      { name: "Desa", need: "Surat warga, informasi, pengaduan, dan arsip.", offer: "Portal desa, surat online, complaint tracking, digital archive." },
      { name: "Kelurahan", need: "Layanan administrasi, status pengajuan, dan laporan.", offer: "Service desk, status tracking, queue dashboard, report." },
      { name: "Yayasan", need: "Donasi, program, relawan, dan laporan transparansi.", offer: "Donation page, program dashboard, volunteer CRM, public report." },
      { name: "Koperasi", need: "Anggota, simpan pinjam, tagihan, dan laporan.", offer: "Member system, loan module, billing, finance report." },
      { name: "Layanan Komunitas", need: "Pendaftaran, program, jadwal, dan komunikasi anggota.", offer: "Registration portal, program calendar, member broadcast, dashboard." },
      { name: "Church", need: "Data jemaat, jadwal ibadah, pelayanan, aset, dan donasi.", offer: "Member CRM, event calendar, volunteer roster, donation tracking." }
    ]
  },
  {
    name: "Internal Operations",
    icon: "Building",
    pain: "Data leads, KPI karyawan, dan kolaborasi project tim yang masih terpisah.",
    solution: "CRM terpadu, Project Management, dan KPI tracker yang tersentralisasi di Portal Omnia.",
    color: "professional-cyan",
    segments: [
      { name: "Omnia HRIS", need: "Absensi, cuti, payroll, dan KPI internal Omnia.", offer: "Attendance & GPS, Leave approval, Payroll & payslip, Advanced payroll, Reimbursement, Field report, Performance KPI, ATS recruitment." },
      { name: "CRM & Leads", need: "Tracking trial user, integrasi CS, dan penagihan poin.", offer: "Lead CRM, Trial tracker, CS points system, Pipeline dashboard." },
      { name: "Project Management", need: "Backlog tim programmer, timeline, dan sprint.", offer: "Sprint board, Backlog tracker, Timeline view, Task assignment." },
      { name: "KPI & Performance", need: "Scoring karyawan, pencapaian sales, dan bonus CS.", offer: "KPI dashboard, Goal tracker, CS performance report, Bonus calculation." }
    ]
  }
];
