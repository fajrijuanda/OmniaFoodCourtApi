import { PrismaClient } from "@prisma/client";
import { industries } from "../prisma/seed-data/industries";

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
  "E-Learning (LMS)": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"],
  "KKN & Fieldwork": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"],
  "Layanan Akademik": ["Rp2jt", "Rp5jt", "Rp10jt+", "Mulai Rp25jt"]
};

const profile = [
  { description: "Untuk mulai digitalisasi.", fit: "Tim kecil", limits: ["1 outlet"] },
  { description: "Untuk tim aktif.", fit: "Rutin pakai sistem.", limits: ["hingga 8 user"] },
  { description: "Untuk multi-role.", fit: "Bisnis bertumbuh.", limits: ["multi-cabang"] },
  { description: "Untuk scope custom.", fit: "Korporasi.", limits: ["custom user"] }
];

const higherEducationTierProfile = [
  { description: "Sistem dasar 1", fit: "Kampus kecil", limits: ["500 mhs"] },
  { description: "Sistem menengah", fit: "Kampus berkembang", limits: ["2000 mhs"] },
  { description: "Sistem pro", fit: "Kampus besar", limits: ["10000 mhs"] },
  { description: "Enterprise", fit: "Grup universitas", limits: ["Unlimited mhs"] }
];

async function main() {
  const educationIndustryConfig = industries.find(i => i.name === "Pendidikan & Kursus");
  if (!educationIndustryConfig) throw new Error("Education industry config not found");

  const indSlug = slugify(educationIndustryConfig.name);
  const dbIndustry = await prisma.industry.findUnique({ where: { slug: indSlug } });
  if (!dbIndustry) throw new Error("Industry not found in DB");

  const segmentsToPatch = ["E-Learning (LMS)", "KKN & Fieldwork", "Layanan Akademik"];

  for (const segment of educationIndustryConfig.segments) {
    if (!segmentsToPatch.includes(segment.name)) continue;

    const subSlug = `${indSlug}-${slugify(segment.name)}`;
    console.log(`Patching ${segment.name} (${subSlug})...`);

    const existingSub = await prisma.subIndustry.findUnique({ where: { slug: subSlug } });
    if (existingSub) {
      console.log(`Already exists: ${segment.name}`);
      continue;
    }

    // Create SubIndustry
    const savedSub = await prisma.subIndustry.create({
      data: {
        industryId: dbIndustry.id,
        name: segment.name,
        slug: subSlug,
        need: segment.need,
        offer: segment.offer,
        sortOrder: 10,
        isActive: true
      }
    });

    // Create Features
    const lmsFeatureNames = ["Campus LMS", "Sistem Kelas dan Mata Kuliah", "Tugas dan Assignment", "Presensi Online", "Penilaian / Gradebook"];
    const kknFeatureNames = ["Manajemen Kelompok KKN", "Plotting Lokasi KKN", "Logbook Harian", "Laporan Akhir Kelompok"];
    const academicFeatureNames = ["Pengajuan Surat Mahasiswa", "Approval Dosen / Admin", "Repositori Dokumen", "Billing Akademik"];

    const isLms = segment.name === "E-Learning (LMS)";
    const isKkn = segment.name === "KKN & Fieldwork";
    const isAcademic = segment.name === "Layanan Akademik";

    const featureNames = isLms ? lmsFeatureNames : isKkn ? kknFeatureNames : isAcademic ? academicFeatureNames : ["Fitur dasar"];

    await prisma.feature.createMany({
      data: featureNames.map((name, i) => ({
        subIndustryId: savedSub.id,
        name,
        sortOrder: i,
        isActive: true
      }))
    });

    // Create Tiers
    const prices = segmentTierPrices[segment.name] || tierPrices;
    await prisma.tier.createMany({
      data: tierNames.map((tierName, tierIndex) => ({
        subIndustryId: savedSub.id,
        name: `${segment.name} ${tierName}`,
        slug: `${subSlug}-${slugify(tierName)}`,
        price: prices[tierIndex],
        cadence: "/ bulan",
        description: higherEducationTierProfile[tierIndex].description,
        fit: higherEducationTierProfile[tierIndex].fit,
        limitsJson: JSON.stringify(higherEducationTierProfile[tierIndex].limits),
        sortOrder: tierIndex,
        isActive: true
      }))
    });

    console.log(`Successfully patched ${segment.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
