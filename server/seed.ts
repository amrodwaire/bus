import { db } from "./storage";
import * as schema from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

export async function seedIfEmpty() {
    try {
        console.log("🧹 جاري تنظيف الحسابات التجريبية القديمة...");

        // 1. حذف الباص التجريبي القديم عشان نقدر نحذف السائق
        await db.delete(schema.buses).where(eq(schema.buses.plateNumber, "أ ب ج 1234"));

        // 2. حذف حسابات user1 و driver1 المعلقة من جذورها
        await db.delete(schema.users).where(inArray(schema.users.username, ["user1", "driver1"]));

        console.log("🌱 جاري بناء الحسابات التجريبية من الصفر بتشفير جديد...");

        const hashedPassword = await hashPassword("123456");

        // إضافة حساب السائق الجديد المشفر
        const [driver] = await db.insert(schema.users).values({
            username: "driver1",
            password: hashedPassword,
            fullName: "أحمد محمد السائق",
            phone: "0791234567",
            role: "driver",
            nationalId: "9876543210",
            licenseNumber: "DRV-001",
        }).returning();

        // إضافة حساب المواطن الجديد المشفر
        await db.insert(schema.users).values({
            username: "user1",
            password: hashedPassword,
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

        console.log("🎉 تم ضبط الحسابات التجريبية بنجاح 100%!");
        console.log("👨‍✈️ السائق:  driver1 / 123456");
        console.log("👤 المواطن: user1   / 123456");

    } catch (error) {
        console.error("❌ خطأ في الـ seed:", error);
    }
}