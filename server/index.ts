import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Pool } from "pg";
import cors from "cors";

const app = express();

// إعداد الكورس (CORS) - السماح للموبايل بالوصول الكامل
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === "production";

// الرابط الجديد الخاص بك على Render
const RENDER_URL = "https://bus-p4kg.onrender.com";

if (isProduction) {
    if (!process.env.SESSION_SECRET) {
        throw new Error("SESSION_SECRET environment variable is required in production");
    }
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is required in production");
    }
    // ضروري لـ Render للتعامل مع الـ HTTPS Proxy
    app.set("trust proxy", 1);
}

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

if (process.env.DATABASE_URL) {
    const PgStore = connectPgSimple(session);
    const sessionPool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    app.use(
        session({
            store: new PgStore({
                pool: sessionPool,
                tableName: "session",
                createTableIfMissing: true,
            }),
            secret: process.env.SESSION_SECRET || "coster-dev-only-secret",
            resave: false,
            saveUninitialized: false,
            proxy: isProduction,
            cookie: {
                secure: isProduction,
                httpOnly: true,
                maxAge: 30 * 24 * 60 * 60 * 1000,
                // ضبط السياسة لتتوافق مع نطاق Render وتطبيق الموبايل
                sameSite: isProduction ? "none" : "lax",
            },
        }),
    );
}

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

(async () => {
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
            log(`serving on port ${port} at ${RENDER_URL}`);
        },
    );
})();
