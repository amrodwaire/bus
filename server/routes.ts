import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertUserSchema, insertBusSchema, insertReservationSchema, insertIssueReportSchema } from "@shared/schema";
import { z } from "zod";

// ============ وظيفة الحسابات التجريبية (Seeding) ============
async function seedTestAccounts() {
    try {
        console.log("Checking for test accounts in database...");

        // 1. حساب المواطن التجريبي
        const citizen = await storage.getUserByUsername("user1");
        if (!citizen) {
            console.log("Seeding: Creating test citizen (user1)...");
            await storage.createUser({
                username: "user1",
                password: "123456",
                fullName: "Citizen Test User",
                phone: "0000000000", // تم التعديل من phoneNumber إلى phone بناءً على أخطاء TS
                nationalId: "000",
                role: "citizen"
            });
        }

        // 2. حساب السائق التجريبي
        const driver = await storage.getUserByUsername("driver1");
        if (!driver) {
            console.log("Seeding: Creating test driver (driver1)...");
            await storage.createUser({
                username: "driver1",
                password: "123456",
                fullName: "Driver Test User",
                phone: "1111111111", // تم التعديل من phoneNumber إلى phone
                nationalId: "111",
                role: "driver"
            });
        }

        console.log("Database seeding completed successfully.");
    } catch (error) {
        console.error("Error during database seeding:", error);
    }
}

// ============ TRAFFIC ALERTS (Live In-Memory System) ============
interface TrafficAlert {
    id: string;
    type: string; // 'road_closed', 'traffic_jam', 'accident'
    lat: number;
    lng: number;
    reportedBy: string;
    timestamp: number;
}
let trafficAlerts: TrafficAlert[] = [];

export async function registerRoutes(
    httpServer: Server,
    app: Express
): Promise<Server> {

    // تشغيل وظيفة الحسابات التجريبية عند بدء تشغيل المسارات
    seedTestAccounts();

    // إعداد نظام التحقق (Passport Auth)
    setupAuth(app);

    // ============ AUTH ROUTES ============

    // Login
    app.post("/api/auth/login", async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
            }

            const user = await storage.getUserByUsername(username);

            if (!user || user.password !== password) {
                return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
            }

            const { password: _, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword });
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    // Register
    app.post("/api/auth/register", async (req, res) => {
        try {
            const parseResult = insertUserSchema.safeParse(req.body);

            if (!parseResult.success) {
                return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
            }

            const existingUser = await storage.getUserByUsername(parseResult.data.username);
            if (existingUser) {
                return res.status(400).json({ message: "اسم المستخدم مستخدم بالفعل" });
            }

            const user = await storage.createUser(parseResult.data);
            const { password: _, ...userWithoutPassword } = user;

            res.status(201).json({ user: userWithoutPassword });
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    // ============ BUS ROUTES ============

    app.get("/api/buses", async (_req, res) => {
        try {
            const buses = await storage.getVisibleBuses();
            res.json(buses);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.get("/api/buses/driver/:driverId", async (req, res) => {
        try {
            const bus = await storage.getBusByDriver(req.params.driverId);
            res.json(bus || null);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.get("/api/buses/:id", async (req, res) => {
        try {
            const bus = await storage.getBus(req.params.id);
            if (!bus) {
                return res.status(404).json({ message: "الباص غير موجود" });
            }
            res.json(bus);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.post("/api/buses", async (req, res) => {
        try {
            const parseResult = insertBusSchema.safeParse(req.body);

            if (!parseResult.success) {
                return res.status(400).json({ message: "بيانات غير صالحة", errors: parseResult.error.errors });
            }

            const bus = await storage.createBus(parseResult.data);
            res.status(201).json(bus);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.patch("/api/buses/:id", async (req, res) => {
        try {
            const currentBus = await storage.getBus(req.params.id);
            if (!currentBus) {
                return res.status(404).json({ message: "الباص غير موجود" });
            }

            const allowedFields = ["currentPassengers", "isVisible", "currentLat", "currentLng", "routeName", "price", "speed"];
            const updates: Record<string, any> = {};

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            if (updates.currentPassengers !== undefined) {
                const passengers = Number(updates.currentPassengers);
                if (isNaN(passengers) || passengers < 0 || passengers > currentBus.totalCapacity) {
                    return res.status(400).json({ message: "عدد الركاب غير صالح" });
                }
                updates.currentPassengers = passengers;

                if (passengers >= currentBus.totalCapacity) {
                    updates.isVisible = false;
                }
            }

            const bus = await storage.updateBus(req.params.id, updates);
            res.json(bus);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    // ============ ROUTE WAYPOINTS ============

    app.get("/api/routes", async (_req, res) => {
        try {
            const allRoutes = await storage.getAllRouteWaypoints();
            res.json(allRoutes);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.get("/api/routes/:busId", async (req, res) => {
        try {
            const waypoints = await storage.getRouteWaypoints(req.params.busId);
            res.json(waypoints);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.post("/api/routes/:busId", async (req, res) => {
        try {
            const { waypoints } = req.body;

            if (!Array.isArray(waypoints)) {
                return res.status(400).json({ message: "بيانات غير صالحة" });
            }

            await storage.deleteRouteWaypoints(req.params.busId);

            const createdWaypoints = [];
            for (let i = 0; i < waypoints.length; i++) {
                const wp = await storage.createRouteWaypoint({
                    busId: req.params.busId,
                    lat: waypoints[i].lat,
                    lng: waypoints[i].lng,
                    orderIndex: i,
                    name: waypoints[i].name || null
                });
                createdWaypoints.push(wp);
            }

            res.status(201).json(createdWaypoints);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    // ============ RESERVATION ROUTES ============

    app.get("/api/reservations/user/:userId", async (req, res) => {
        try {
            const reservations = await storage.getReservationsByUser(req.params.userId);
            res.json(reservations);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.get("/api/reservations/user/:userId/active", async (req, res) => {
        try {
            const reservation = await storage.getActiveReservationByUser(req.params.userId);
            res.json(reservation || null);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.get("/api/reservations/bus/:busId", async (req, res) => {
        try {
            const reservations = await storage.getReservationsByBus(req.params.busId);
            const withPassengers = await Promise.all(
                reservations.map(async (r) => {
                    const passenger = await storage.getUser(r.passengerId);
                    return {
                        ...r,
                        passengerName: passenger?.fullName ?? null,
                        passengerPhone: passenger?.phone ?? null,
                    };
                })
            );
            res.json(withPassengers);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.post("/api/reservations", async (req, res) => {
        try {
            const { busId, pickupLat, pickupLng, passengerId } = req.body;

            if (!busId || pickupLat === undefined || pickupLng === undefined) {
                return res.status(400).json({ message: "بيانات غير صالحة" });
            }

            const bus = await storage.getBus(busId);
            if (!bus) {
                return res.status(404).json({ message: "الباص غير موجود" });
            }

            if (bus.currentPassengers >= bus.totalCapacity) {
                return res.status(400).json({ message: "الباص ممتلئ" });
            }

            if (passengerId && passengerId !== "anonymous") {
                const existingReservation = await storage.getActiveReservationByUser(passengerId);
                if (existingReservation) {
                    return res.status(400).json({
                        message: "لديك حجز نشط بالفعل. يرجى إلغاء حجزك الحالي قبل حجز باص جديد",
                        code: "ACTIVE_RESERVATION_EXISTS"
                    });
                }
            }

            const priority = await storage.getNextPriority(busId);

            const reservation = await storage.createReservation({
                passengerId: passengerId || "anonymous",
                busId,
                pickupLat,
                pickupLng,
                status: "confirmed",
                priority
            });

            const newPassengerCount = bus.currentPassengers + 1;
            await storage.updateBus(busId, {
                currentPassengers: newPassengerCount,
                isVisible: newPassengerCount >= bus.totalCapacity ? false : bus.isVisible
            });

            res.status(201).json(reservation);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    app.patch("/api/reservations/:id", async (req, res) => {
        try {
            const { status } = req.body;
            if (!status || !["pending", "confirmed", "completed", "cancelled"].includes(status)) {
                return res.status(400).json({ message: "حالة غير صالحة" });
            }

            const currentReservation = await storage.getReservation(req.params.id);
            if (!currentReservation) {
                return res.status(404).json({ message: "الحجز غير موجود" });
            }

            if (status === "cancelled" && currentReservation.status !== "cancelled") {
                const bus = await storage.getBus(currentReservation.busId);
                if (bus) {
                    const newPassengerCount = Math.max(0, bus.currentPassengers - 1);
                    await storage.updateBus(bus.id, {
                        currentPassengers: newPassengerCount,
                        isVisible: true
                    });
                }
            }

            const reservation = await storage.updateReservation(req.params.id, { status });
            res.json(reservation);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ في الخادم" });
        }
    });

    // ============ SEARCH & OTHER API ============

    app.get("/api/search/location", async (req, res) => {
        try {
            const q = req.query.q as string;
            const lang = (req.query.lang as string) || "ar";
            if (!q || q.length < 2) return res.json([]);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jo&limit=5&accept-language=${lang}`;
            const response = await fetch(url, {
                headers: { "User-Agent": "Coster-JordanTransport/1.0" }
            });
            const data = await response.json();
            res.json(data);
        } catch {
            res.json([]);
        }
    });

    // ============ TRAFFIC ALERTS API ============

    app.post("/api/traffic-alerts", (req, res) => {
        try {
            const { type, lat, lng, reportedBy } = req.body;
            if (!type || lat == null || lng == null) {
                return res.status(400).json({ message: "بيانات الموقع والنوع مطلوبة" });
            }

            const newAlert: TrafficAlert = {
                id: `alt_${Date.now()}`,
                type, lat, lng,
                reportedBy: reportedBy || "driver",
                timestamp: Date.now()
            };

            trafficAlerts.push(newAlert);
            res.status(201).json(newAlert);
        } catch (error) {
            res.status(500).json({ message: "حدث خطأ أثناء إضافة البلاغ" });
        }
    });

    app.get("/api/traffic-alerts", (_req, res) => {
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        trafficAlerts = trafficAlerts.filter(alert => alert.timestamp > twoHoursAgo);
        res.json(trafficAlerts);
    });

    return httpServer;
}