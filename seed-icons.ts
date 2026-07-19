import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const segmentIcons: Record<string, string> = {
  "Cafe": "Coffee",
  "Restaurant": "Utensils",
  "Restoran": "Utensils",
  "Cloud Kitchen": "Cloud",
  "Bakery": "Coffee",
  "Food Court": "Store",
  "General Clinic": "Stethoscope",
  "Klinik Umum": "Stethoscope",
  "Dental Clinic": "Smile",
  "Beauty Clinic": "Sparkles",
  "Klinik Kecantikan": "Sparkles",
  "Veterinary Clinic": "Activity",
  "Pharmacy": "Pill",
  "Apotek": "Pill",
  "Minimarket": "ShoppingBasket",
  "Hardware Store": "Hammer",
  "Toko Bangunan": "Hammer",
  "Fashion Store": "Shirt",
  "Electronics Store": "Monitor",
  "Retail Pharmacy": "Plus",
  "D2C Brand": "Star",
  "Brand D2C": "Star",
  "Online Fashion": "Shirt",
  "Fashion Online": "Shirt",
  "Beauty Store": "Sparkles",
  "Electronics": "Laptop",
  "Elektronik": "Laptop",
  "Digital Products": "Download",
  "Produk Digital": "Download",
  "Social Commerce Intelligence": "Radar",
  "Tutoring": "BookOpen",
  "Bimbel": "BookOpen",
  "Language Course": "Globe",
  "Kursus Bahasa": "Globe",
  "Bootcamp": "Terminal",
  "Sekolah": "GraduationCap",
  "School": "GraduationCap",
  "Training Center": "Presentation",
  "E-Learning (LMS)": "GraduationCap",
  "KKN & Fieldwork": "Map",
  "Layanan Akademik": "Landmark",
  "Higher Education": "GraduationCap",
  "Campus Management System": "GraduationCap",
  "Consultant": "Briefcase",
  "Konsultan": "Briefcase",
  "Software House": "Monitor",
  "Agency Kreatif": "Lightbulb",
  "Kantor Hukum": "Scale",
  "Law Firm": "Scale",
  "Agency": "Lightbulb",
  "HRIS": "Users",
  "Architect": "Compass",
  "Arsitek": "Compass",
  "Accounting Firm": "Calculator",
  "Kantor Akuntan": "Calculator",
  "FMCG": "Truck",
  "Pharmaceuticals": "Pill",
  "Farmasi": "Pill",
  "Building Materials": "Hammer",
  "Bahan Bangunan": "Hammer",
  "Spareparts": "Wrench",
  "Sparepart": "Wrench",
  "Wholesale": "Package",
  "Grosir": "Package",
  "Apparel": "Scissors",
  "Konveksi": "Scissors",
  "Furniture": "Armchair",
  "Printing": "Printer",
  "Percetakan": "Printer",
  "Packaged Food": "Search",
  "Makanan Kemasan": "Search",
  "Workshop": "PenTool",
  "Developer": "Building",
  "Broker": "Handshake",
  "Boarding House": "Home",
  "Kost": "Home",
  "Apartment": "Building2",
  "Apartemen": "Building2",
  "Property Management": "LayoutDashboard",
  "F&B Franchise": "Store",
  "Laundry": "Droplets",
  "Retail Franchise": "Tags",
  "Education Franchise": "GraduationCap",
  "Brand Partnership": "Network",
  "Kemitraan Brand": "Network",
  "Seminar": "Mic",
  "Workshop (Event)": "Users",
  "Expo": "Ticket",
  "Community": "Users",
  "Komunitas": "Users",
  "Event Organizer": "Calendar",
  "Village": "Map",
  "Desa": "Map",
  "Sub-district": "Landmark",
  "Kelurahan": "Landmark",
  "Foundation": "Heart",
  "Yayasan": "Heart",
  "Cooperative": "Wallet",
  "Koperasi": "Wallet",
  "Layanan Komunitas": "Users",
  "Church": "Heart",
  "Omnia HRIS": "Users",
  "CRM & Leads": "Users",
  "Project Management": "LayoutDashboard",
  "KPI & Performance": "Activity"
};

async function main() {
  const subIndustries = await prisma.subIndustry.findMany();
  
  for (const sub of subIndustries) {
    let iconKey = segmentIcons[sub.name] ?? "LayoutDashboard";
    
    await prisma.subIndustry.update({
      where: { id: sub.id },
      data: {
        iconKey: iconKey
      }
    });
    console.log(`Updated ${sub.name} with icon ${iconKey}`);
  }
  
  // also sync color from industry to sub-industry if they are null
  const industries = await prisma.industry.findMany({ include: { subIndustries: true } });
  for (const ind of industries) {
    for (const sub of ind.subIndustries) {
      if (!sub.colorKey) {
        await prisma.subIndustry.update({
          where: { id: sub.id },
          data: { colorKey: ind.colorKey }
        });
        console.log(`Updated color of ${sub.name} to ${ind.colorKey}`);
      }
    }
  }

  console.log("Done seeding icons and colors!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
