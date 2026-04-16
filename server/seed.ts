import { db } from "./storage";
import * as schema from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

export async function seedIfEmpty() {
    try {
        console.log("🧹 جاري تنظيف الحسابات المشفرة القديمة...");

        // مسح الباص عشان نقدر نمسح السائق
        await db.delete(schema.buses).where(eq(schema.buses.plateNumber, "أ ب ج 1234"));

        // مسح الحسابات القديمة من جذورها
        await db.delete(schema.users).where(inArray(schema.users.username, ["user1", "driver1"]));

        console.log("🌱 جاري بناء الحسابات بنص عادي (بدون تشفير) ليتطابق مع نظامك...");

        // إضافة حساب السائق
        const [driver] = await db.insert(schema.users).values({
            username: "driver1",
            password: "123456", // رجعناها نص عادي
            fullName: "أحمد محمد السائق",
            phone: "0791234567",
            role: "driver",
            nationalId: "9876543210",
            licenseNumber: "DRV-001",
        }).returning();

        // إضافة حساب المواطن
        await db.insert(schema.users).values({
            username: "user1",
            password: "123456", // رجعناها نص عادي
            fullName: "محمد علي المواطن",
            phone: "0799876543",
            role: "citizen",
            nationalId: "1234567890",
        });

        // إضافة الباص التجريبي
        await db.insert(schema.buses).values({
            driverId: driver.id,
            plateNumber: "أ ب ج 1234",
            routeName: "عمان - الزرقاء",
            routeNameEn: "Amman - Zarqa",
            governorate: "amman",
            destinationGovernorate: "zarqa",
            totalCapacity: 15,
            currentPassengers: 3,
            isVisible: true,
            currentLat: 31.9539,
            currentLng: 35.9106,
            price: 0.5,
        });

        console.log("🎉 تم ضبط الحسابات التجريبية بنجاح!");
        console.log("👨‍✈️ السائق:  driver1 / 123456");
        console.log("👤 المواطن: user1   / 123456");

    } catch (error) {
        console.error("❌ خطأ في الـ seed:", error);
    }
}