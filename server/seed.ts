import { db } from "./storage";
import * as schema from "@shared/schema";
import { inArray } from "drizzle-orm";

export async function seedIfEmpty() {
    try {
        console.log("🔄 جاري إعادة ضبط الحسابات التجريبية...");

        // امسح الحسابات التجريبية القديمة فقط وأعد إنشاءها
        await db.delete(schema.buses);
        await db.delete(schema.users).where(
            inArray(schema.users.username, ["driver1", "user1"])
        );

        // إضافة السائق
        const [driver] = await db.insert(schema.users).values({
            username: "driver1",
            password: "123456",
            fullName: "أحمد محمد السائق",
            phone: "0791234567",
            role: "driver",
            nationalId: "9876543210",
            licenseNumber: "DRV-001",
        }).returning();

        // إضافة المواطن
        await db.insert(schema.users).values({
            username: "user1",
            password: "123456",
            fullName: "محمد علي المواطن",
            phone: "0799876543",
            role: "citizen",
            nationalId: "1234567890",
        });

        // إضافة باص تجريبي
        await db.insert(schema.buses).values({
            driverId: driver.id,
            plateNumber: "أ ب ج 1234",
            routeName: "عمان - الزرقاء",
            routeNameEn: "Amman - Zarqa",
            governorate: "amman",
            destinationGovernorate: "zarqa",
            totalCapacity: 15,
            currentPassengers: 0,
            isVisible: true,
            currentLat: 31.9539,
            currentLng: 35.9106,
            price: 0.5,
        });

        console.log("✅ تم ضبط الحسابات التجريبية!");
        console.log("👨‍✈️ driver1 / 123456");
        console.log("👤 user1 / 123456");

    } catch (error) {
        console.error("❌ خطأ في الـ seed:", error);
    }
}