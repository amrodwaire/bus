import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./storage";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const scryptAsync = promisify(scrypt);

declare module "http" {
    interface IncomingMessage {
        rawBody: unknown;
    }
}

app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
            let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
            if (capturedJsonResponse) {
                logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
            }
            log(logLine);
        }
    });

    next();
});

// ✅ بناء الجداول تلقائياً
async function createTablesIfNotExist() {
    try {
        log("🔧 جاري التحقق من الجداول...");

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'citizen',
                national_id TEXT,
                license_number TEXT
            )
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS buses (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
                driver_id VARCHAR NOT NULL,
                plate_number TEXT NOT NULL,
                route_name TEXT NOT NULL,
                route_name_en TEXT,
                governorate TEXT,
                destination_governorate TEXT,
                total_capacity INTEGER NOT NULL DEFAULT 15,
                current_passengers INTEGER NOT NULL DEFAULT 0,
                is_visible BOOLEAN NOT NULL DEFAULT true,
                current_lat REAL,
                current_lng REAL,
                price REAL,
                speed REAL
            )
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS route_waypoints (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
                bus_id VARCHAR NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                order_index INTEGER NOT NULL,
                name TEXT
            )
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS reservations (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
                passenger_id VARCHAR NOT NULL,
                bus_id VARCHAR NOT NULL,
                pickup_lat REAL NOT NULL,
                pickup_lng REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                priority INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS issue_reports (
                id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        log("✅ الجداول جاهزة");
    } catch (error) {
        log(`❌ خطأ في بناء الجداول: ${error}`);
        throw error;
    }
}

// أداة تشفير كلمة المرور
async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

// ✅ إضافة البيانات التجريبية تلقائياً
async function seedIfEmpty() {
    try {
        // 🔥 تنظيف الحسابات التجريبية القديمة اللي مش مشفرة
        await db.execute(sql`DELETE FROM users WHERE password = '123456'`);

        const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        const count = Number((result.rows[0] as any).count);

        if (count > 0) {
            log("✅ البيانات موجودة مسبقاً (ومشفرة)");
            return;
        }

        log("🌱 إضافة البيانات التجريبية...");

        // تشفير الباسوورد قبل الحفظ
        const hashedPassword = await hashPassword("123456");

        // إضافة السائق
        const driverResult = await db.execute(sql`
            INSERT INTO users (username, password, full_name, phone, role, national_id, license_number)
            VALUES ('driver1', ${hashedPassword}, 'أحمد محمد السائق', '0791234567', 'driver', '9876543210', 'DRV-001')
            RETURNING id
        `);
        const driverId = (driverResult.rows[0] as any).id;

        // إضافة المواطن
        await db.execute(sql`
            INSERT INTO users (username, password, full_name, phone, role, national_id)
            VALUES ('user1', ${hashedPassword}, 'محمد علي المواطن', '0799876543', 'citizen', '1234567890')
        `);

        // إضافة باص تجريبي
        await db.execute(sql`
            INSERT INTO buses (driver_id, plate_number, route_name, route_name_en, governorate, destination_governorate, total_capacity, current_passengers, is_visible, current_lat, current_lng, price)
            VALUES (${driverId}, 'أ ب ج 1234', 'عمان - الزرقاء', 'Amman - Zarqa', 'amman', 'zarqa', 15, 3, true, 31.9539, 35.9106, 0.5)
        `);

        log("🎉 تم إضافة البيانات التجريبية بنجاح!");
        log("👨‍✈️ السائق:  driver1 / 123456");
        log("👤 المواطن: user1   / 123456");

    } catch (error) {
        log(`❌ خطأ في الـ seed: ${error}`);
    }
}

(async () => {
    // ✅ بناء الجداول أولاً ثم البيانات
    await createTablesIfNotExist();
    await seedIfEmpty();

    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Internal Server Error:", err);
        if (res.headersSent) {
            return next(err);
        }
        return res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
        serveStatic(app);
    } else {
        const { setupVite } = await import("./vite");
        await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
        {
            port,
            host: "0.0.0.0",
            reusePort: true,
        },
        () => {
            log(`serving on port ${port}`);
        },
    );
})();