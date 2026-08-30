import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db, storage } from "./storage";
import {
  buses,
  insertUserSchema,
  insertBusSchema,
  reservations,
} from "@shared/schema";
import { authenticateUser, hashPassword, requireAuth, requireRole, stripPassword } from "./auth";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const reservationRequestSchema = z.object({
  busId: z.string().min(1),
  pickupLat: z.number().finite(),
  pickupLng: z.number().finite(),
});

const reservationStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});

const reportSchema = z.object({
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

const waypointsSchema = z.object({
  waypoints: z.array(
    z.object({
      lat: z.number().finite(),
      lng: z.number().finite(),
      name: z.string().trim().min(1).nullable().optional(),
    }),
  ),
});

function canAccessUserResource(requesterId: string | undefined, targetUserId: string) {
  return requesterId === targetUserId;
}

function readParam(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getBusDistanceViolationMessage() {
  return "موقعك بعيد جداً عن مسار الباص. يرجى اختيار باص أقرب إليك";
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

function isRateLimitedLogin(ip: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  if (!attempts || attempts.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  attempts.count += 1;
  loginAttempts.set(ip, attempts);
  return attempts.count > MAX_LOGIN_ATTEMPTS;
}

function clearLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

const loginRateLimit: RequestHandler = (req, res, next) => {
  const requesterIp = req.ip ?? "unknown";
  if (isRateLimitedLogin(requesterIp)) {
    return res.status(429).json({ message: "محاولات كثيرة، حاول لاحقاً" });
  }
  res.locals.requesterIp = requesterIp;
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get("/api/auth/csrf-token", (req, res) => {
    return res.json({ csrfToken: req.session.csrfToken });
  });

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const requesterIp = (res.locals.requesterIp as string) ?? "unknown";

      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const user = await authenticateUser(parseResult.data.username, parseResult.data.password);
      if (!user) {
        return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      clearLoginAttempts(requesterIp);
      req.session.userId = user.id;
      req.user = user;
      return res.json({ user: stripPassword(user) });
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userParse = insertUserSchema
        .extend({
          username: z.string().trim().min(1),
          password: z.string().min(6),
          fullName: z.string().trim().min(1),
          phone: z.string().trim().min(1),
          role: z.enum(["citizen", "driver"]).default("citizen"),
          nationalId: z.string().trim().nullable().optional(),
          licenseNumber: z.string().trim().nullable().optional(),
        })
        .safeParse(req.body);

      if (!userParse.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: userParse.error.errors });
      }

      const existingUser = await storage.getUserByUsername(userParse.data.username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم مستخدم بالفعل" });
      }

      const hashedPassword = await hashPassword(userParse.data.password);
      const user = await storage.createUser({
        ...userParse.data,
        password: hashedPassword,
        nationalId: userParse.data.nationalId ?? null,
        licenseNumber: userParse.data.licenseNumber ?? null,
      });

      req.session.userId = user.id;
      req.user = user;
      return res.status(201).json({ user: stripPassword(user) });
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ message: "تعذر تسجيل الخروج" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "تم تسجيل الخروج" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    return res.json({ user: stripPassword(req.user!) });
  });

  app.get("/api/buses", async (_req, res) => {
    try {
      const visibleBuses = await storage.getVisibleBuses();
      return res.json(visibleBuses);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/buses/driver/:driverId", requireRole("driver"), async (req, res) => {
    try {
      const driverId = readParam(req.params.driverId);
      if (!canAccessUserResource(req.user?.id, driverId)) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول" });
      }

      const bus = await storage.getBusByDriver(driverId);
      return res.json(bus ?? null);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/buses/:id", async (req, res) => {
    try {
      const busId = readParam(req.params.id);
      const bus = await storage.getBus(busId);
      if (!bus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      return res.json(bus);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/buses", requireRole("driver"), async (req, res) => {
    try {
      const parseResult = insertBusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
      }

      if (parseResult.data.driverId !== req.user!.id) {
        return res.status(403).json({ message: "لا يمكنك إنشاء باص لسائق آخر" });
      }

      const bus = await storage.createBus(parseResult.data);
      return res.status(201).json(bus);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.patch("/api/buses/:id", requireRole("driver"), async (req, res) => {
    try {
      const busId = readParam(req.params.id);
      const currentBus = await storage.getBus(busId);
      if (!currentBus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }

      if (currentBus.driverId !== req.user!.id) {
        return res.status(403).json({ message: "لا يمكنك تعديل هذا الباص" });
      }

      const allowedFields = ["currentPassengers", "isVisible", "currentLat", "currentLng", "routeName", "price"];
      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (updates.currentPassengers !== undefined) {
        const passengers = Number(updates.currentPassengers);
        if (Number.isNaN(passengers) || passengers < 0 || passengers > currentBus.totalCapacity) {
          return res.status(400).json({ message: "عدد الركاب غير صالح" });
        }
        updates.currentPassengers = passengers;

        if (passengers >= currentBus.totalCapacity) {
          updates.isVisible = false;
        }
      }

      const bus = await storage.updateBus(busId, updates);
      return res.json(bus);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/routes", async (_req, res) => {
    try {
      const allRoutes = await storage.getAllRouteWaypoints();
      return res.json(allRoutes);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/routes/:busId", async (req, res) => {
    try {
      const busId = readParam(req.params.busId);
      const waypoints = await storage.getRouteWaypoints(busId);
      return res.json(waypoints);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/routes/:busId", requireRole("driver"), async (req, res) => {
    try {
      const busId = readParam(req.params.busId);
      const bus = await storage.getBus(busId);
      if (!bus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      if (bus.driverId !== req.user!.id) {
        return res.status(403).json({ message: "لا يمكنك تعديل هذا المسار" });
      }

      const parseResult = waypointsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
      }

      await storage.deleteRouteWaypoints(busId);

      const createdWaypoints = [];
      for (let index = 0; index < parseResult.data.waypoints.length; index += 1) {
        const point = parseResult.data.waypoints[index];
        const waypoint = await storage.createRouteWaypoint({
          busId,
          lat: point.lat,
          lng: point.lng,
          orderIndex: index,
          name: point.name ?? null,
        });
        createdWaypoints.push(waypoint);
      }

      return res.status(201).json(createdWaypoints);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/reservations/user/:userId", requireAuth, async (req, res) => {
    try {
      const userId = readParam(req.params.userId);
      if (!canAccessUserResource(req.user?.id, userId)) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول" });
      }

      const userReservations = await storage.getReservationsByUser(userId);
      return res.json(userReservations);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/reservations/user/:userId/active", requireAuth, async (req, res) => {
    try {
      const userId = readParam(req.params.userId);
      if (!canAccessUserResource(req.user?.id, userId)) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول" });
      }

      const activeReservation = await storage.getActiveReservationByUser(userId);
      return res.json(activeReservation ?? null);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/reservations/bus/:busId", requireRole("driver"), async (req, res) => {
    try {
      const busId = readParam(req.params.busId);
      const bus = await storage.getBus(busId);
      if (!bus) {
        return res.status(404).json({ message: "الباص غير موجود" });
      }
      if (bus.driverId !== req.user!.id) {
        return res.status(403).json({ message: "ليس لديك صلاحية للوصول" });
      }

      const busReservations = await storage.getReservationsByBus(busId);
      const withPassengers = await Promise.all(
        busReservations.map(async (reservation) => {
          const passenger = await storage.getUser(reservation.passengerId);
          return {
            ...reservation,
            passengerName: passenger?.fullName ?? null,
            passengerPhone: passenger?.phone ?? null,
          };
        }),
      );
      return res.json(withPassengers);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/reservations", requireRole("citizen"), async (req, res) => {
    try {
      const parseResult = reservationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
      }

      const passengerId = req.user!.id;
      const { busId, pickupLat, pickupLng } = parseResult.data;

      const createdReservation = await db.transaction(async (tx) => {
        const busRows = await tx
          .select()
          .from(buses)
          .where(eq(buses.id, busId))
          .for("update");

        const bus = busRows[0];
        if (!bus) {
          return { error: { status: 404, message: "الباص غير موجود" } } as const;
        }

        if (bus.currentPassengers >= bus.totalCapacity) {
          return { error: { status: 400, message: "الباص ممتلئ" } } as const;
        }

        const existingReservations = await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.passengerId, passengerId),
              inArray(reservations.status, ["pending", "confirmed"]),
            ),
          );

        if (existingReservations.length > 0) {
          return {
            error: {
              status: 400,
              message: "لديك حجز نشط بالفعل. يرجى إلغاء حجزك الحالي قبل حجز باص جديد",
              code: "ACTIVE_RESERVATION_EXISTS",
            },
          } as const;
        }

        if (bus.currentLat !== null && bus.currentLng !== null) {
          const latDiff = pickupLat - bus.currentLat;
          const lngDiff = pickupLng - bus.currentLng;
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          if (distance > 0.5) {
            return { error: { status: 400, message: getBusDistanceViolationMessage() } } as const;
          }
        }

        const [priorityResult] = await tx
          .select({ maxPriority: max(reservations.priority) })
          .from(reservations)
          .where(and(eq(reservations.busId, busId), inArray(reservations.status, ["pending", "confirmed"])));

        const nextPriority = (priorityResult.maxPriority ?? 0) + 1;

        const [reservation] = await tx
          .insert(reservations)
          .values({
            passengerId,
            busId,
            pickupLat,
            pickupLng,
            status: "confirmed",
            priority: nextPriority,
          })
          .returning();

        const newPassengerCount = bus.currentPassengers + 1;
        const isFull = newPassengerCount >= bus.totalCapacity;

        await tx
          .update(buses)
          .set({
            currentPassengers: newPassengerCount,
            isVisible: isFull ? false : bus.isVisible,
          })
          .where(eq(buses.id, bus.id));

        return { reservation } as const;
      });

      if ("error" in createdReservation && createdReservation.error) {
        const reservationError = createdReservation.error;
        return res
          .status(reservationError.status)
          .json({ message: reservationError.message, code: reservationError.code });
      }

      return res.status(201).json(createdReservation.reservation);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.patch("/api/reservations/:id", requireAuth, async (req, res) => {
    try {
      const reservationId = readParam(req.params.id);
      const parseResult = reservationStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "حالة غير صالحة" });
      }

      const currentReservation = await storage.getReservation(reservationId);
      if (!currentReservation) {
        return res.status(404).json({ message: "الحجز غير موجود" });
      }

      const targetStatus = parseResult.data.status;

      if (req.user!.role === "citizen") {
        if (currentReservation.passengerId !== req.user!.id || targetStatus !== "cancelled") {
          return res.status(403).json({ message: "ليس لديك صلاحية لهذا التعديل" });
        }
      }

      if (req.user!.role === "driver") {
        const bus = await storage.getBus(currentReservation.busId);
        if (!bus || bus.driverId !== req.user!.id) {
          return res.status(403).json({ message: "ليس لديك صلاحية لهذا التعديل" });
        }
      }

      if (targetStatus === "cancelled" && currentReservation.status !== "cancelled") {
        const bus = await storage.getBus(currentReservation.busId);
        if (bus) {
          const newPassengerCount = Math.max(0, bus.currentPassengers - 1);
          const wasFull = bus.currentPassengers >= bus.totalCapacity;
          await storage.updateBus(bus.id, {
            currentPassengers: newPassengerCount,
            ...(wasFull ? { isVisible: true } : {}),
          });
        }
      }

      const reservation = await storage.updateReservation(reservationId, { status: targetStatus });
      return res.json(reservation);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.post("/api/reports", requireAuth, async (req, res) => {
    try {
      const parseResult = reportSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "النوع والوصف مطلوبان", errors: parseResult.error.errors });
      }

      const report = await storage.createIssueReport({
        userId: req.user!.id,
        category: parseResult.data.category,
        description: parseResult.data.description,
        status: "pending",
      });

      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
      return res.status(201).json({ ...report, ticketNumber });
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/reports", requireRole("driver"), async (_req, res) => {
    try {
      const reports = await storage.getIssueReports();
      return res.json(reports);
    } catch {
      return res.status(500).json({ message: "حدث خطأ في الخادم" });
    }
  });

  app.get("/api/search/location", async (req, res) => {
    try {
      const { q, lang } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json([]);
      }
      const language = lang === "ar" ? "ar" : "en";
      const publicUrl = process.env.APP_PUBLIC_URL ?? "https://bus-app.vercel.app";
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jo&limit=5&accept-language=${language}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": `BusApp/1.0 (${publicUrl})`,
          "Accept-Language": language,
        },
      });

      if (!response.ok) {
        return res.json([]);
      }

      const data = await response.json();
      return res.json(data);
    } catch {
      return res.json([]);
    }
  });

  return httpServer;
}
