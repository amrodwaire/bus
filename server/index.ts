import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./storage";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";
import { seedIfEmpty } from "./seed";
import { setupAuth } from "./auth";

// 👇 هذا السطر اللي كان طاير بالغلط!
const app = express();
const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultFrontendOrigin = process.env.FRONTEND_ORIGIN ?? "https://bus-app.vercel.app";
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : [defaultFrontendOrigin];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    }),
);

const httpServer = createServer(app);

// ... (باقي الكود زي ما هو تحت)

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
setupAuth(app);

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

(async () => {
    // ✅ 1. بناء الجداول أولاً
    await createTablesIfNotExist();

    // ✅ 2. استدعاء التنظيف وإضافة الحسابات الصح من ملف seed.ts الخارجي
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