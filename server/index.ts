import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";

const app = express();

// تعديل الـ CORS ليكون متوافق مع الموبايل و Railway Health Check
app.use(cors({
    origin: (origin, callback) => {
        // السماح بالطلبات اللي بدون أصل (زي الموبايل) أو أي أصل آخر لضمان عمل البحث
        if (!origin) return callback(null, true);
        callback(null, true);
    },
    credentials: true
}));

const httpServer = createServer(app);

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

// لوغ لكل الطلبات لمراقبة ما يحدث
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

(async () => {
    // 1. تسجيل الطرق
    await registerRoutes(httpServer, app);

    // 2. معالجة الأخطاء
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Internal Server Error:", err);
        if (res.headersSent) {
            return next(err);
        }
        return res.status(status).json({ message });
    });

    // 3. الملفات الثابتة
    if (process.env.NODE_ENV === "production") {
        serveStatic(app);
    } else {
        const { setupVite } = await import("./vite");
        await setupVite(httpServer, app);
    }

    // 4. تشغيل السيرفر (التعديل الأهم لـ Railway)
    const port = Number(process.env.PORT) || 5000;
    httpServer.listen(port, "0.0.0.0", () => {
        log(`serving on port ${port}`);
    });
})();
