import type { Governorate } from "@shared/schema";

// Jordan governorate boundaries (approximate center points and radius for detection)
const governorateBounds: Record<Governorate, { lat: number; lng: number; radiusKm: number }> = {
  amman: { lat: 31.9539, lng: 35.9106, radiusKm: 30 },
  zarqa: { lat: 32.0728, lng: 36.0880, radiusKm: 25 },
  irbid: { lat: 32.5560, lng: 35.8500, radiusKm: 30 },
  balqa: { lat: 32.0392, lng: 35.7278, radiusKm: 20 },
  karak: { lat: 31.1853, lng: 35.7047, radiusKm: 35 },
  tafilah: { lat: 30.8375, lng: 35.6044, radiusKm: 25 },
  maan: { lat: 30.1962, lng: 35.7341, radiusKm: 50 },
  aqaba: { lat: 29.5320, lng: 35.0063, radiusKm: 30 },
  jerash: { lat: 32.2747, lng: 35.8961, radiusKm: 15 },
  ajloun: { lat: 32.3333, lng: 35.7500, radiusKm: 15 },
  madaba: { lat: 31.7160, lng: 35.7939, radiusKm: 20 },
  mafraq: { lat: 32.3422, lng: 36.2083, radiusKm: 40 },
};

// Governorate display names in Arabic and English
export const governorateNames: Record<Governorate, { ar: string; en: string }> = {
  amman: { ar: "عمان", en: "Amman" },
  zarqa: { ar: "الزرقاء", en: "Zarqa" },
  irbid: { ar: "إربد", en: "Irbid" },
  balqa: { ar: "البلقاء", en: "Balqa" },
  karak: { ar: "الكرك", en: "Karak" },
  tafilah: { ar: "الطفيلة", en: "Tafilah" },
  maan: { ar: "معان", en: "Ma'an" },
  aqaba: { ar: "العقبة", en: "Aqaba" },
  jerash: { ar: "جرش", en: "Jerash" },
  ajloun: { ar: "عجلون", en: "Ajloun" },
  madaba: { ar: "مادبا", en: "Madaba" },
  mafraq: { ar: "المفرق", en: "Mafraq" },
};

// Calculate distance between two points using Haversine formula
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Detect governorate from coordinates
export function detectGovernorate(lat: number, lng: number): Governorate | null {
  let closest: Governorate | null = null;
  let minDistance = Infinity;

  for (const [gov, bounds] of Object.entries(governorateBounds) as [Governorate, typeof governorateBounds[Governorate]][]) {
    const distance = getDistanceKm(lat, lng, bounds.lat, bounds.lng);
    if (distance <= bounds.radiusKm && distance < minDistance) {
      minDistance = distance;
      closest = gov;
    }
  }

  // Default to Amman if no match (most common case)
  return closest || "amman";
}

// Get governorate display name in current language
export function getGovernorateName(gov: Governorate | null | undefined, language: "ar" | "en"): string {
  if (!gov || !governorateNames[gov]) return language === "ar" ? "عمان" : "Amman";
  return governorateNames[gov][language];
}
