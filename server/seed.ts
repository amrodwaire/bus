import { db } from "./storage";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// دالة التشفير (مدمجة هنا لتجنب أخطاء الاستيراد)
async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

export async function seedIfEmpty() {
    try {
        // 🔥 تنظيف الحسابات القديمة اللي الباسوورد تبعها مش مشفر (نص عادي)
        await db.delete(schema.users).where(eq(schema.users.password, "123456"));

        // تحقق إذا في مستخدمين أصلاً (مشفرين وجاهزين)
        const existingUsers = await db.select().from(schema.users).limit(1);
        if (existingUsers.length > 0) {
            console.log("✅ البيانات موجودة مسبقاً ومُشفرة، تخطي الـ seed");
            return;
        }

        console.log("🌱 قاعدة البيانات فاضية أو تم تنظيفها، جاري إضافة البيانات التجريبية...");

        // تشفير كلمة المرور
        const hashedPassword = await hashPassword("123456");

        // إضافة حساب السائق
        const [driver] = await db.insert(schema.users).values({
            username: "driver1",
            password: hashedPassword,
            fullName: "أحمد محمد السائق",
            phone: "0791234567",
            role: "driver",
            nationalId: "9876543210",
            licenseNumber: "DRV-001",
        }).returning();

        // إضافة حساب المواطن
        await db.insert(schema.users).values({
            username: "user1",
            password: hashedPassword,
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
            currentPassengers: 3,
            isVisible: true,
            currentLat: 31.9539,
            currentLng: 35.9106,
            price: 0.5,
        });

        console.log("🎉 البيانات التجريبية جاهزة!");
        console.log("👨‍✈️ السائق:  driver1 / 123456");
        console.log("👤 المواطن: user1   / 123456");

    } catch (error) {
        console.error("❌ خطأ في الـ seed:", error);
    }
}