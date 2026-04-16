import { db } from "./storage";
import * as schema from "@shared/schema";

export async function seedIfEmpty() {
    try {
        // تحقق إذا في مستخدمين أصلاً — إذا في، لا تعمل شي
        const existingUsers = await db.select().from(schema.users).limit(1);
        
        if (existingUsers.length > 0) {
            console.log("✅ البيانات موجودة، تخطي الـ seed");
            return;
        }

        console.log("🌱 قاعدة البيانات فاضية، جاري إضافة الحسابات التجريبية...");

        // إضافة حساب السائق
        const [driver] = await db.insert(schema.users).values({
            username: "driver1",
            password: "123456",
            fullName: "أحمد محمد السائق",
            phone: "0791234567",
            role: "driver",
            nationalId: "9876543210",
            licenseNumber: "DRV-001",
        }).returning();

        console.log("✅ تم إنشاء حساب السائق: driver1");

        // إضافة حساب المواطن
        await db.insert(schema.users).values({
            username: "user1",
            password: "123456",
            fullName: "محمد علي المواطن",
            phone: "0799876543",
            role: "citizen",
            nationalId: "1234567890",
        });

        console.log("✅ تم إنشاء حساب المواطن: user1");

        // إضافة باص تجريبي
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

        console.log("✅ تم إنشاء الباص التجريبي");
        console.log("🎉 جاهز!");
        console.log("👨‍✈️ السائق:  driver1 / 123456");
        console.log("👤 المواطن: user1   / 123456");

    } catch (error) {
        console.error("❌ خطأ في الـ seed:", error);
    }
}