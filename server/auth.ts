import type { Express, RequestHandler } from "express";
import session from "express-session";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User as SelectUser } from "@shared/schema";

const scrypt = promisify(scryptCallback);
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SelectUser;
    }
  }
}

function isHashedPassword(password: string) {
  return password.startsWith(`${HASH_PREFIX}$`);
}

export function stripPassword(user: SelectUser) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, storedPassword: string) {
  if (!isHashedPassword(storedPassword)) {
    return password === storedPassword;
  }

  const [, salt, originalHashHex] = storedPassword.split("$");
  if (!salt || !originalHashHex) {
    return false;
  }

  const calculatedHash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const originalHash = Buffer.from(originalHashHex, "hex");
  if (originalHash.length !== calculatedHash.length) {
    return false;
  }

  return timingSafeEqual(originalHash, calculatedHash);
}

export async function authenticateUser(username: string, password: string) {
  const user = await storage.getUserByUsername(username);
  if (!user) return undefined;

  const passwordMatches = await verifyPassword(password, user.password);
  if (!passwordMatches) return undefined;

  if (!isHashedPassword(user.password)) {
    const updatedHashedPassword = await hashPassword(password);
    await storage.updateUserPassword(user.id, updatedHashedPassword);
    const updatedUser = await storage.getUser(user.id);
    return updatedUser ?? user;
  }

  return user;
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required");
  }

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use(async (req, _res, next) => {
    try {
      if (!req.session.userId) {
        req.user = undefined;
        return next();
      }
      const user = await storage.getUser(req.session.userId);
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(24).toString("hex");
    }

    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    if (req.path === "/api/auth/login" || req.path === "/api/auth/register" || req.path === "/api/auth/csrf-token") {
      return next();
    }

    const csrfToken = req.get("x-csrf-token");
    if (!csrfToken || csrfToken !== req.session.csrfToken) {
      return res.status(403).json({ message: "طلب غير صالح، رمز الحماية مفقود" });
    }

    next();
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "غير مصرح، يرجى تسجيل الدخول" });
  }
  next();
};

export const requireRole = (...roles: SelectUser["role"][]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "غير مصرح، يرجى تسجيل الدخول" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "ليس لديك صلاحية للوصول" });
    }
    next();
  };
};